/**
 * EcoSense Device Hardware Sensors Module
 * Interfaces with real browser APIs: Geolocation, Web Audio API (Mic),
 * AmbientLightSensor (with strict "Not Available" detection), and Camera.
 */

const EcoSenseSensors = {
  // Audio state
  audioContext: null,
  analyser: null,
  microphoneStream: null,
  audioAnimFrame: null,
  isRecordingAudio: false,
  audioStats: {
    currentDb: 0,
    minDb: Infinity,
    maxDb: -Infinity,
    sumDb: 0,
    count: 0
  },

  // Camera state
  cameraStream: null,

  // Monitor Page Microphone State
  monitorMic: {
    stream: null,
    audioContext: null,
    analyser: null,
    animFrame: null,
    isActive: false,
    stats: { currentDb: 0, minDb: Infinity, maxDb: -Infinity, sumDb: 0, count: 0 }
  },

  // Monitor Page Camera-Based Ambient Light State
  monitorCamera: {
    stream: null,
    videoEl: null,
    canvasEl: null,
    animFrame: null,
    isActive: false,
    stats: { currentLux: 0, rawLuminance: 0, minLux: Infinity, maxLux: -Infinity, sumLux: 0, count: 0 }
  },

  // Light sensor state
  lightSensorInstance: null,
  lightSensorSupported: false,

  // GPS state
  currentLocation: null,

  /**
   * Initialize sensor capabilities detection on page load
   */
  async initAudit() {
    this.checkLightSensorSupport();
    this.checkGeolocationSupport();
    this.checkMicSupport();
    this.checkCameraSupport();
  },

  /* ========================================================
     1. GEOLOCATION / GPS
     ======================================================== */
  checkGeolocationSupport() {
    const elStatus = document.getElementById('gps-status-badge');
    if (!('geolocation' in navigator)) {
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-unavailable';
        elStatus.innerHTML = '<span class="status-pulse"></span> Not Supported';
      }
      return false;
    }
    return true;
  },

  getGPSLocation() {
    return new Promise((resolve, reject) => {
      const elStatus = document.getElementById('gps-status-badge');
      const elCoords = document.getElementById('gps-coords-display');
      const elAccuracy = document.getElementById('gps-accuracy-display');

      if (!('geolocation' in navigator)) {
        if (elStatus) {
          elStatus.className = 'sensor-status-badge status-unavailable';
          elStatus.textContent = 'Not Available';
        }
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-pending';
        elStatus.innerHTML = '<span class="status-pulse"></span> Requesting GPS...';
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.currentLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            altitude: pos.coords.altitude ? Math.round(pos.coords.altitude) : null
          };

          if (elStatus) {
            elStatus.className = 'sensor-status-badge status-active';
            elStatus.innerHTML = '<span class="status-pulse"></span> GPS Locked';
          }
          if (elCoords) {
            elCoords.textContent = `${pos.coords.latitude.toFixed(5)}°, ${pos.coords.longitude.toFixed(5)}°`;
          }
          if (elAccuracy) {
            elAccuracy.textContent = `Accuracy: ±${Math.round(pos.coords.accuracy)}m ${pos.coords.altitude ? `| Alt: ${Math.round(pos.coords.altitude)}m` : ''}`;
          }

          resolve(this.currentLocation);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          if (elStatus) {
            elStatus.className = 'sensor-status-badge status-denied';
            elStatus.textContent = err.code === 1 ? 'Permission Denied' : 'Signal Unavailable';
          }
          if (elCoords) elCoords.textContent = 'Not Available';
          if (elAccuracy) elAccuracy.textContent = 'Check browser location permissions';
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  /* ========================================================
     2. MICROPHONE / ACOUSTIC NOISE SENSOR (Web Audio API)
     ======================================================== */
  checkMicSupport() {
    const elStatus = document.getElementById('mic-status-badge');
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!hasMedia && elStatus) {
      elStatus.className = 'sensor-status-badge status-unavailable';
      elStatus.textContent = 'Not Available';
    }
  },

  async startAcousticSampling(onUpdate) {
    if (this.isRecordingAudio) return;

    const elStatus = document.getElementById('mic-status-badge');
    const elVal = document.getElementById('mic-reading-val');
    const elMeta = document.getElementById('mic-reading-meta');
    const canvas = document.getElementById('mic-canvas');

    try {
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-pending';
        elStatus.innerHTML = '<span class="status-pulse"></span> Requesting Mic...';
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.microphoneStream = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      this.isRecordingAudio = true;
      this.audioStats = { currentDb: 0, minDb: 999, maxDb: 0, sumDb: 0, count: 0 };

      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-active';
        elStatus.innerHTML = '<span class="status-pulse"></span> Mic Active (Sampling)';
      }

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(this.analyser.fftSize);

      let canvasCtx = null;
      if (canvas) {
        canvasCtx = canvas.getContext('2d');
      }

      const sampleLoop = () => {
        if (!this.isRecordingAudio) return;

        // Calculate RMS sound pressure level
        this.analyser.getByteTimeDomainData(timeData);
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128; // -1 to 1
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        
        // Approximate dB(A) SPL calibration:
        // rms = 0.001 -> ~35-40 dB (quiet room)
        // rms = 0.05  -> ~65 dB (normal conversation)
        // rms = 0.5+  -> ~85-95 dB (loud noise)
        let db = rms > 0.0001 ? Math.round(20 * Math.log10(rms) + 95) : 30;
        db = Math.max(30, Math.min(115, db)); // clamp realistic audible range

        this.audioStats.currentDb = db;
        this.audioStats.minDb = Math.min(this.audioStats.minDb, db);
        this.audioStats.maxDb = Math.max(this.audioStats.maxDb, db);
        this.audioStats.sumDb += db;
        this.audioStats.count++;

        const avgDb = Math.round(this.audioStats.sumDb / this.audioStats.count);

        if (elVal) elVal.textContent = db;
        if (elMeta) {
          elMeta.textContent = `Min: ${this.audioStats.minDb} dB | Avg: ${avgDb} dB | Max: ${this.audioStats.maxDb} dB`;
        }

        // Update VU meter bar if present
        const vuBar = document.getElementById('mic-vu-bar');
        if (vuBar) {
          const pct = Math.max(5, Math.min(100, ((db - 30) / (100 - 30)) * 100));
          vuBar.style.width = pct + '%';
        }

        // Draw animated oscilloscope waveform
        if (canvas && canvasCtx) {
          canvasCtx.fillStyle = '#0f172a';
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = db > 75 ? '#ef4444' : db > 60 ? '#eab308' : '#10b981';
          canvasCtx.beginPath();

          const sliceWidth = canvas.width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);

            x += sliceWidth;
          }

          canvasCtx.lineTo(canvas.width, canvas.height / 2);
          canvasCtx.stroke();
        }

        if (typeof onUpdate === 'function') {
          onUpdate(db, avgDb);
        }

        this.audioAnimFrame = requestAnimationFrame(sampleLoop);
      };

      sampleLoop();
    } catch (err) {
      console.warn('Microphone access failed:', err);
      this.isRecordingAudio = false;
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-denied';
        elStatus.textContent = 'Permission Denied';
      }
      if (elVal) elVal.textContent = 'Not Available';
      if (elMeta) elMeta.textContent = 'Microphone permission blocked or unavailable';
    }
  },

  stopAcousticSampling() {
    this.isRecordingAudio = false;
    if (this.audioAnimFrame) cancelAnimationFrame(this.audioAnimFrame);
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(t => t.stop());
      this.microphoneStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    const elStatus = document.getElementById('mic-status-badge');
    if (elStatus && elStatus.textContent.includes('Sampling')) {
      elStatus.className = 'sensor-status-badge status-pending';
      elStatus.textContent = 'Standby (Paused)';
    }
  },

  /* ========================================================
     MONITOR PAGE ACOUSTIC METER (Continuous Analysis)
     ======================================================== */
  async startMonitorMic(callbacks = {}) {
    if (this.monitorMic.isActive) return true;

    const elStatus = document.getElementById('monitor-mic-status-badge');
    const elVal = document.getElementById('form-mic-live-db');
    const elQual = document.getElementById('form-mic-qualitative-badge');
    const elStats = document.getElementById('form-mic-stats');
    const elGauge = document.getElementById('monitor-gauge-fill');
    const canvas = document.getElementById('monitor-osc-canvas');
    const btnStart = document.getElementById('btn-monitor-mic-start');
    const btnStop = document.getElementById('btn-monitor-mic-stop');

    try {
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-pending';
        elStatus.innerHTML = '<span class="status-pulse"></span> Requesting Permission...';
      }

      // Ask for microphone permission using browser API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.monitorMic.stream = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.monitorMic.audioContext = new AudioCtx();
      const source = this.monitorMic.audioContext.createMediaStreamSource(stream);

      this.monitorMic.analyser = this.monitorMic.audioContext.createAnalyser();
      this.monitorMic.analyser.fftSize = 2048;
      this.monitorMic.analyser.smoothingTimeConstant = 0.75;
      source.connect(this.monitorMic.analyser);

      this.monitorMic.isActive = true;
      this.monitorMic.stats = { currentDb: 0, minDb: Infinity, maxDb: -Infinity, sumDb: 0, count: 0 };

      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-active';
        elStatus.innerHTML = '<span class="mic-active-pulse"></span> Analyzing Audio (Live)';
      }
      if (btnStart) btnStart.style.display = 'none';
      if (btnStop) btnStop.style.display = 'inline-flex';

      const bufferLength = this.monitorMic.analyser.frequencyBinCount;
      const timeData = new Uint8Array(this.monitorMic.analyser.fftSize);
      const canvasCtx = canvas ? canvas.getContext('2d') : null;
      let smoothDb = 0;

      const sampleLoop = () => {
        if (!this.monitorMic.isActive) return;

        // Continuously analyze microphone audio: calculate RMS sound pressure
        this.monitorMic.analyser.getByteTimeDomainData(timeData);
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / timeData.length);

        // Indicative sound-level estimate (clamped to realistic 30 - 110 dB)
        let instantDb = rms > 0.0001 ? Math.round(20 * Math.log10(rms) + 95) : 32;
        instantDb = Math.max(30, Math.min(110, instantDb));

        if (smoothDb === 0) smoothDb = instantDb;
        else smoothDb = smoothDb * 0.7 + instantDb * 0.3;

        const db = Math.round(smoothDb);

        // Record stats
        this.monitorMic.stats.currentDb = db;
        if (db < this.monitorMic.stats.minDb) this.monitorMic.stats.minDb = db;
        if (db > this.monitorMic.stats.maxDb) this.monitorMic.stats.maxDb = db;
        this.monitorMic.stats.sumDb += db;
        this.monitorMic.stats.count++;

        const avgDb = Math.round(this.monitorMic.stats.sumDb / this.monitorMic.stats.count);

        // Update prominent numeric reading
        if (elVal) {
          elVal.textContent = db;
          elVal.style.color = db > 80 ? '#ef4444' : db > 65 ? '#f59e0b' : '#34d399';
        }

        // Update qualitative label
        if (elQual) {
          if (db < 45) {
            elQual.innerHTML = '<span>🟢</span> <span>Quiet Study Zone (< 45 dB)</span>';
            elQual.style.borderColor = '#10b981';
          } else if (db <= 65) {
            elQual.innerHTML = '<span>🟡</span> <span>Moderate Conversation (45–65 dB)</span>';
            elQual.style.borderColor = '#14b8a6';
          } else if (db <= 80) {
            elQual.innerHTML = '<span>🟠</span> <span>Elevated Acoustic Noise (65–80 dB)</span>';
            elQual.style.borderColor = '#f59e0b';
          } else {
            elQual.innerHTML = '<span>🔴</span> <span>Loud / High Exposure (> 80 dB)</span>';
            elQual.style.borderColor = '#ef4444';
          }
        }

        // Update Min/Avg/Max stats
        if (elStats) {
          elStats.innerHTML = `
            <div>Min: <strong>${this.monitorMic.stats.minDb} dB</strong></div>
            <div>Avg: <strong>${avgDb} dB</strong></div>
            <div>Max: <strong>${this.monitorMic.stats.maxDb} dB</strong></div>
          `;
        }

        // Update live VU meter gauge
        if (elGauge) {
          const pct = Math.max(5, Math.min(100, ((db - 30) / (110 - 30)) * 100));
          elGauge.style.width = pct + '%';
        }

        // Draw animated oscilloscope waveform
        if (canvas && canvasCtx) {
          canvasCtx.fillStyle = '#090d16';
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = db > 80 ? '#ef4444' : db > 65 ? '#f59e0b' : '#10b981';
          canvasCtx.beginPath();

          const sliceWidth = canvas.width / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * canvas.height) / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
          }
          canvasCtx.lineTo(canvas.width, canvas.height / 2);
          canvasCtx.stroke();
        }

        // Synchronize hidden value field
        const formVal = document.getElementById('form-value');
        if (formVal) formVal.value = db;

        if (typeof callbacks.onUpdate === 'function') {
          callbacks.onUpdate(db, avgDb);
        }

        this.monitorMic.animFrame = requestAnimationFrame(sampleLoop);
      };

      sampleLoop();
      return true;
    } catch (err) {
      console.warn('Monitor microphone access failed:', err);
      this.monitorMic.isActive = false;
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-denied';
        elStatus.textContent = 'Permission Denied / Unavailable';
      }
      if (elVal) elVal.textContent = 'Denied';
      if (elQual) {
        elQual.innerHTML = '<span style="color:#ef4444;">⚠️ Microphone access blocked in browser</span>';
      }
      if (btnStart) {
        btnStart.style.display = 'inline-flex';
        btnStart.textContent = 'Retry Microphone Access';
      }
      if (btnStop) btnStop.style.display = 'none';

      if (typeof callbacks.onError === 'function') {
        callbacks.onError(err);
      }
      return false;
    }
  },

  stopMonitorMic() {
    if (!this.monitorMic.isActive) return;
    this.monitorMic.isActive = false;

    if (this.monitorMic.animFrame) cancelAnimationFrame(this.monitorMic.animFrame);
    if (this.monitorMic.stream) {
      this.monitorMic.stream.getTracks().forEach(t => t.stop());
      this.monitorMic.stream = null;
    }
    if (this.monitorMic.audioContext && this.monitorMic.audioContext.state !== 'closed') {
      this.monitorMic.audioContext.close();
      this.monitorMic.audioContext = null;
    }

    const elStatus = document.getElementById('monitor-mic-status-badge');
    const btnStart = document.getElementById('btn-monitor-mic-start');
    const btnStop = document.getElementById('btn-monitor-mic-stop');

    if (elStatus) {
      elStatus.className = 'sensor-status-badge status-pending';
      elStatus.textContent = 'Standby (Paused)';
    }
    if (btnStart) {
      btnStart.style.display = 'inline-flex';
      btnStart.textContent = '🎙️ Resume Microphone';
    }
    if (btnStop) btnStop.style.display = 'none';
  },

  /* ========================================================
     MONITOR PAGE CAMERA-BASED AMBIENT LIGHT SENSOR
     (Continuous Optical Luminance & Indicative Lux Analysis)
     ======================================================== */
  async startMonitorCamera(callbacks = {}) {
    if (this.monitorCamera.isActive) return true;

    const elStatus = document.getElementById('monitor-light-status-badge');
    const elVal = document.getElementById('form-light-live-lux');
    const elQual = document.getElementById('form-light-qualitative-badge');
    const elStats = document.getElementById('form-light-stats');
    const elGauge = document.getElementById('monitor-light-gauge-fill');
    const video = document.getElementById('monitor-light-video');
    const placeholder = document.getElementById('monitor-light-placeholder');
    const reticle = document.querySelector('.camera-light-reticle');
    const btnStart = document.getElementById('btn-monitor-camera-start');
    const btnStop = document.getElementById('btn-monitor-camera-stop');

    try {
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-pending';
        elStatus.innerHTML = '<span class="status-pulse"></span> Requesting Camera...';
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access (getUserMedia unavailable).');
      }

      // Request rear-facing camera when available, fallback to default
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch (errFacing) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      this.monitorCamera.stream = stream;
      this.monitorCamera.isActive = true;
      this.monitorCamera.stats = { currentLux: 0, rawLuminance: 0, minLux: Infinity, maxLux: -Infinity, sumLux: 0, count: 0 };

      if (video) {
        video.srcObject = stream;
        video.style.display = 'block';
        await video.play();
      }
      if (placeholder) placeholder.style.display = 'none';
      if (reticle) reticle.style.display = 'flex';

      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-active';
        elStatus.innerHTML = '<span class="status-pulse"></span> Camera Active (Analyzing)';
      }
      if (btnStart) btnStart.style.display = 'none';
      if (btnStop) btnStop.style.display = 'inline-flex';

      // Setup 64x64 canvas for fast frame luminance processing
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.monitorCamera.canvasEl = canvas;

      let smoothLux = 0;

      const sampleLoop = () => {
        if (!this.monitorCamera.isActive) return;

        if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          ctx.drawImage(video, 0, 0, 64, 64);
          const frame = ctx.getImageData(0, 0, 64, 64);
          const data = frame.data;

          let sumLum = 0;
          const pixelCount = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            // Perceived luminance (ITU-R BT.709)
            sumLum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          }

          const avgLum = sumLum / pixelCount; // 0 to 255
          const norm = avgLum / 255;

          // Indicative lux conversion (device & auto-exposure dependent)
          let instantLux;
          if (norm < 0.08) {
            instantLux = Math.round(1 + norm * 200);
          } else if (norm < 0.45) {
            instantLux = Math.round(20 + Math.pow(norm, 1.7) * 1200);
          } else if (norm < 0.8) {
            instantLux = Math.round(300 + Math.pow(norm, 2.2) * 5000);
          } else {
            instantLux = Math.round(2500 + Math.pow(norm, 3) * 35000);
          }

          if (smoothLux === 0) smoothLux = instantLux;
          else smoothLux = smoothLux * 0.75 + instantLux * 0.25;

          const lux = Math.round(smoothLux);

          // Update stats
          this.monitorCamera.stats.currentLux = lux;
          this.monitorCamera.stats.rawLuminance = Math.round(avgLum);
          if (lux < this.monitorCamera.stats.minLux) this.monitorCamera.stats.minLux = lux;
          if (lux > this.monitorCamera.stats.maxLux) this.monitorCamera.stats.maxLux = lux;
          this.monitorCamera.stats.sumLux += lux;
          this.monitorCamera.stats.count++;

          const avgLux = Math.round(this.monitorCamera.stats.sumLux / this.monitorCamera.stats.count);

          // Update UI Readout
          if (elVal) elVal.textContent = lux;

          // Qualitative Comfort Classification
          let qualText = 'Standard Living / Work Light';
          let qualEmoji = '💡';
          let qualBg = '#fef3c7';
          let qualColor = '#92400e';
          let qualBorder = '#fde68a';

          if (lux < 50) {
            qualText = 'Very Low Light / Night Condition (< 50 lux)';
            qualEmoji = '🌑';
            qualBg = '#f1f5f9';
            qualColor = '#334155';
            qualBorder = '#cbd5e1';
          } else if (lux < 200) {
            qualText = 'Dim Indoor / Corridor (50 - 200 lux)';
            qualEmoji = '🛋️';
            qualBg = '#fef3c7';
            qualColor = '#92400e';
            qualBorder = '#fde68a';
          } else if (lux < 600) {
            qualText = 'Adequate Study / Office Illuminance (200 - 600 lux)';
            qualEmoji = '📖';
            qualBg = '#ecfdf5';
            qualColor = '#065f46';
            qualBorder = '#a7f3d0';
          } else if (lux < 2500) {
            qualText = 'Bright Daylight / Overcast Outdoor (600 - 2500 lux)';
            qualEmoji = '⛅';
            qualBg = '#eff6ff';
            qualColor = '#1d4ed8';
            qualBorder = '#bfdbfe';
          } else {
            qualText = 'High Solar Irradiance / Direct Sunlight (> 2500 lux)';
            qualEmoji = '☀️';
            qualBg = '#fff7ed';
            qualColor = '#c2410c';
            qualBorder = '#fed7aa';
          }

          if (elQual) {
            elQual.innerHTML = `<span>${qualEmoji}</span> <span>${qualText}</span>`;
            elQual.style.background = qualBg;
            elQual.style.color = qualColor;
            elQual.style.borderColor = qualBorder;
          }

          if (elStats) {
            elStats.innerHTML = `
              <div>Min: <strong>${this.monitorCamera.stats.minLux} lux</strong></div>
              <div>Avg: <strong>${avgLux} lux</strong></div>
              <div>Max: <strong>${this.monitorCamera.stats.maxLux} lux</strong></div>
            `;
          }

          // Gauge bar scaling (0 to 10,000 lux log scale)
          if (elGauge) {
            const gaugePct = Math.min(100, Math.max(3, (Math.log10(Math.max(1, lux)) / 4.2) * 100));
            elGauge.style.width = gaugePct + '%';
          }

          // Form hidden or mirror value
          const formVal = document.getElementById('form-value');
          if (formVal) formVal.value = lux;
        }

        this.monitorCamera.animFrame = requestAnimationFrame(sampleLoop);
      };

      this.monitorCamera.animFrame = requestAnimationFrame(sampleLoop);
      if (typeof callbacks.onStart === 'function') callbacks.onStart();
      return true;
    } catch (err) {
      console.warn('Camera light meter error:', err);
      this.stopMonitorCamera();

      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-denied';
        elStatus.textContent = 'Camera Denied / Error';
      }
      if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `<span style="color:#ef4444; font-size:1.5rem;">⚠️</span><span style="color:#ef4444;">${err.name === 'NotAllowedError' ? 'Camera permission was denied in browser.' : 'Unable to connect to camera device.'}</span>`;
      }
      if (btnStart) {
        btnStart.style.display = 'inline-flex';
        btnStart.textContent = '📷 Try Camera Again';
      }
      if (btnStop) btnStop.style.display = 'none';

      if (typeof callbacks.onError === 'function') {
        callbacks.onError(err);
      }
      return false;
    }
  },

  stopMonitorCamera() {
    if (!this.monitorCamera.isActive) return;
    this.monitorCamera.isActive = false;

    if (this.monitorCamera.animFrame) {
      cancelAnimationFrame(this.monitorCamera.animFrame);
      this.monitorCamera.animFrame = null;
    }
    if (this.monitorCamera.stream) {
      this.monitorCamera.stream.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
      this.monitorCamera.stream = null;
    }

    const video = document.getElementById('monitor-light-video');
    const placeholder = document.getElementById('monitor-light-placeholder');
    const reticle = document.querySelector('.camera-light-reticle');
    const elStatus = document.getElementById('monitor-light-status-badge');
    const btnStart = document.getElementById('btn-monitor-camera-start');
    const btnStop = document.getElementById('btn-monitor-camera-stop');

    if (video) {
      try {
        video.pause();
        video.srcObject = null;
        video.style.display = 'none';
      } catch (e) {}
    }
    if (placeholder) placeholder.style.display = 'flex';
    if (reticle) reticle.style.display = 'none';

    if (elStatus) {
      elStatus.className = 'sensor-status-badge status-pending';
      elStatus.textContent = 'Standby (Paused)';
    }
    if (btnStart) {
      btnStart.style.display = 'inline-flex';
      btnStart.textContent = '📷 Resume Camera';
    }
    if (btnStop) btnStop.style.display = 'none';
  },

  /* ========================================================
     3. LIGHT SENSOR (AmbientLightSensor API)
     Strictly shows "Not Available" if not supported/disabled.
     ======================================================== */
  checkLightSensorSupport() {
    const elStatus = document.getElementById('light-status-badge');
    const elVal = document.getElementById('light-reading-val');
    const elDesc = document.getElementById('light-status-desc');

    if (!('AmbientLightSensor' in window)) {
      this.lightSensorSupported = false;
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-unavailable';
        elStatus.textContent = 'Not Available';
      }
      if (elVal) {
        elVal.textContent = 'Not Available';
      }
      if (elDesc) {
        elDesc.innerHTML = '<strong>Not Available in this browser:</strong> The W3C <code>AmbientLightSensor</code> Generic Sensor API is disabled by default in desktop browsers (Chrome, Safari, Firefox) for privacy & anti-fingerprinting reasons.';
      }
      return false;
    }

    // Attempt sensor instantiation
    try {
      const sensor = new window.AmbientLightSensor({ frequency: 2 });
      sensor.onerror = (event) => {
        this.lightSensorSupported = false;
        if (elStatus) {
          elStatus.className = 'sensor-status-badge status-unavailable';
          elStatus.textContent = 'Not Available';
        }
        if (elVal) elVal.textContent = 'Not Available';
        if (elDesc) {
          elDesc.innerHTML = `<strong>Sensor Blocked:</strong> ${event.error.name} - Browser policy blocked ambient light hardware access.`;
        }
      };

      sensor.onreading = () => {
        this.lightSensorSupported = true;
        if (elStatus) {
          elStatus.className = 'sensor-status-badge status-active';
          elStatus.innerHTML = '<span class="status-pulse"></span> Active';
        }
        if (elVal) elVal.textContent = Math.round(sensor.illuminance);
      };

      sensor.start();
      this.lightSensorInstance = sensor;
      return true;
    } catch (err) {
      this.lightSensorSupported = false;
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-unavailable';
        elStatus.textContent = 'Not Available';
      }
      if (elVal) elVal.textContent = 'Not Available';
      if (elDesc) {
        elDesc.innerHTML = '<strong>Not Available:</strong> Browser requires <code>chrome://flags/#enable-generic-sensor-extra-classes</code> or hardware photometer support.';
      }
      return false;
    }
  },

  /* ========================================================
     4. CAMERA (Optical / Vision Sensor)
     ======================================================== */
  checkCameraSupport() {
    const elStatus = document.getElementById('camera-status-badge');
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!hasMedia && elStatus) {
      elStatus.className = 'sensor-status-badge status-unavailable';
      elStatus.textContent = 'Not Available';
    }
  },

  async startCameraPreview() {
    const elStatus = document.getElementById('camera-status-badge');
    const video = document.getElementById('camera-preview-video');
    const placeholder = document.getElementById('camera-placeholder');
    const elMeta = document.getElementById('camera-meta-display');

    try {
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-pending';
        elStatus.innerHTML = '<span class="status-pulse"></span> Connecting Camera...';
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      this.cameraStream = stream;

      if (video) {
        video.srcObject = stream;
        video.style.display = 'block';
        video.play();
      }
      if (placeholder) placeholder.style.display = 'none';

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};

      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-active';
        elStatus.innerHTML = '<span class="status-pulse"></span> Camera Active';
      }

      if (elMeta) {
        elMeta.textContent = `${settings.width || 'HD'}x${settings.height || '720'} | ${track.label || 'Optical Sensor Ready'}`;
      }
      return true;
    } catch (err) {
      console.warn('Camera access failed:', err);
      if (elStatus) {
        elStatus.className = 'sensor-status-badge status-denied';
        elStatus.textContent = 'Permission Denied / In Use';
      }
      if (placeholder) {
        placeholder.innerHTML = '<p style="color:#ef4444;">Camera access denied or no camera device detected.</p>';
      }
      return false;
    }
  },

  stopCameraPreview() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    const video = document.getElementById('camera-preview-video');
    const placeholder = document.getElementById('camera-placeholder');
    const elStatus = document.getElementById('camera-status-badge');

    if (video) {
      video.pause();
      video.srcObject = null;
      video.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
    if (elStatus) {
      elStatus.className = 'sensor-status-badge status-pending';
      elStatus.textContent = 'Standby (Inactive)';
    }
  }
};

window.EcoSenseSensors = EcoSenseSensors;
