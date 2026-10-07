/**
 * EcoSense Main Application Controller
 * Handles SPA navigation, section routing, form submission,
 * table search/filter, and UI modals/toasts.
 */

const EcoSenseApp = {
  // Section pages sequence
  pages: ['home', 'sensors', 'record', 'dashboard', 'map', 'observations', 'about'],
  currentPageIndex: 0,

  init() {
    this.setupNavigation();
    this.setupRecordingForm();
    this.setupTableFilters();
    this.setupMapAndGpsControls();
    this.setupParticipationFeature();
    this.setupDemoButtons();
    this.listenDataEvents();

    // Check URL hash or default to home
    const hash = window.location.hash.replace('#', '');
    if (this.pages.includes(hash)) {
      this.navigateTo(hash, false);
    } else {
      this.navigateTo('home', false);
    }

    // Initialize sensors audit
    if (window.EcoSenseSensors) {
      window.EcoSenseSensors.initAudit();
    }

    // Refresh UI with current data
    this.refreshAllViews();
  },

  /* ========================================================
     NAVIGATION & ROUTING
     ======================================================== */
  setupNavigation() {
    // Nav links
    document.querySelectorAll('[data-nav-target]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.getAttribute('data-nav-target');
        this.navigateTo(target);
      });
    });

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('main-nav-links');
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener('click', () => {
        navLinks.classList.toggle('mobile-open');
      });
    }

    // Listen to browser back/forward buttons
    window.addEventListener('popstate', () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      if (this.pages.includes(hash)) {
        this.navigateTo(hash, false);
      }
    });
  },

  navigateTo(pageId, updateHistory = true) {
    if (!this.pages.includes(pageId)) pageId = 'home';
    this.currentPageIndex = this.pages.indexOf(pageId);

    // Update section visibility
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`section-${pageId}`);
    if (targetSection) {
      targetSection.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update top nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-nav-target') === pageId) {
        link.classList.add('active');
      }
    });

    // Close mobile nav drawer if open
    const navLinks = document.getElementById('main-nav-links');
    if (navLinks) navLinks.classList.remove('mobile-open');

    // Stop live monitor microphone and camera if navigating away from the Record section
    if (pageId !== 'record' && window.EcoSenseSensors) {
      window.EcoSenseSensors.stopMonitorMic();
      window.EcoSenseSensors.stopMonitorCamera();
    }

    // Trigger page-specific initializations
    if (pageId === 'dashboard') {
      this.renderDashboard();
    } else if (pageId === 'map') {
      const mode = localStorage.getItem('ecosense_map_view_mode') || 'map_view';
      this.applyMapViewMode(mode);
      if (window.EcoSenseMap && mode !== 'gps_only') {
        setTimeout(() => window.EcoSenseMap.init('ecosense-map'), 100);
      }
    } else if (pageId === 'observations') {
      this.renderObservationsTable();
    } else if (pageId === 'record') {
      // Initialize category UI
      const selectedCat = document.querySelector('input[name="category"]:checked')?.value || 'noise';
      this.updateCategoryUI(selectedCat);

      // Set current datetime if empty
      const dtInput = document.getElementById('form-datetime');
      if (dtInput && !dtInput.value) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dtInput.value = now.toISOString().slice(0, 16);
      }
    }

    if (updateHistory) {
      window.history.pushState(null, '', `#${pageId}`);
    }
  },

  formatPageName(key) {
    const names = {
      home: 'Home',
      sensors: 'Device Sensors',
      record: 'Record Observation',
      dashboard: 'Dashboard',
      map: 'Map',
      observations: 'Observations',
      about: 'Limitations'
    };
    return names[key] || key;
  },

  /* ========================================================
     RECORDING FORM LOGIC
     ======================================================== */
  setupRecordingForm() {
    const form = document.getElementById('record-observation-form');
    if (!form) return;

    // Category change listener
    const categoryRadios = document.querySelectorAll('input[name="category"]');
    categoryRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.updateCategoryUI(radio.value);
      });
    });

    // "Start Microphone" button for Noise Level
    const btnStartMic = document.getElementById('btn-monitor-mic-start');
    if (btnStartMic) {
      btnStartMic.addEventListener('click', async () => {
        if (window.EcoSenseSensors) {
          const success = await window.EcoSenseSensors.startMonitorMic({
            onError: (err) => {
              this.showToast('Microphone access denied. Please allow microphone permissions in your browser.', 'danger');
            }
          });
          if (success) {
            this.showToast('Microphone active: analyzing sound levels in real time', 'success');
          }
        }
      });
    }

    // "Stop Microphone" button
    const btnStopMic = document.getElementById('btn-monitor-mic-stop');
    if (btnStopMic) {
      btnStopMic.addEventListener('click', () => {
        if (window.EcoSenseSensors) {
          window.EcoSenseSensors.stopMonitorMic();
          this.showToast('Microphone paused', 'info');
        }
      });
    }

    // Direct "Record Observation" button in the Live Sound-Level Meter
    const btnRecordNoiseDirect = document.getElementById('btn-record-noise-direct');
    if (btnRecordNoiseDirect) {
      btnRecordNoiseDirect.addEventListener('click', () => {
        this.saveCurrentObservation();
      });
    }

    // "Start Camera" button for Ambient Light
    const btnStartCamera = document.getElementById('btn-monitor-camera-start');
    if (btnStartCamera) {
      btnStartCamera.addEventListener('click', async () => {
        if (window.EcoSenseSensors) {
          const success = await window.EcoSenseSensors.startMonitorCamera({
            onError: (err) => {
              this.showToast('Camera access denied or unavailable: ' + (err.message || 'Permission denied'), 'danger');
            }
          });
          if (success) {
            this.showToast('Camera active: analyzing ambient brightness in real time', 'success');
          }
        }
      });
    }

    // "Stop Camera" button
    const btnStopCamera = document.getElementById('btn-monitor-camera-stop');
    if (btnStopCamera) {
      btnStopCamera.addEventListener('click', () => {
        if (window.EcoSenseSensors) {
          window.EcoSenseSensors.stopMonitorCamera();
          this.showToast('Camera stopped and resources released', 'info');
        }
      });
    }

    // Direct "Record Observation" button in the Camera Ambient Light Meter
    const btnRecordLightDirect = document.getElementById('btn-record-light-direct');
    if (btnRecordLightDirect) {
      btnRecordLightDirect.addEventListener('click', () => {
        this.saveCurrentObservation();
      });
    }

    // "Get My Location" button
    const btnGetLocation = document.getElementById('btn-get-current-location');
    if (btnGetLocation) {
      btnGetLocation.addEventListener('click', async () => {
        btnGetLocation.disabled = true;
        btnGetLocation.innerHTML = '<span>⏳ Querying GPS...</span>';
        try {
          const loc = await window.EcoSenseSensors.getGPSLocation();
          document.getElementById('form-lat').value = loc.lat.toFixed(5);
          document.getElementById('form-lng').value = loc.lng.toFixed(5);
          this.showToast('GPS coordinates captured (±' + loc.accuracy + 'm)', 'success');
        } catch (err) {
          this.showToast('Could not fetch GPS. Please enter coordinates manually.', 'danger');
        } finally {
          btnGetLocation.disabled = false;
          btnGetLocation.innerHTML = '<span>📍 Use My GPS</span>';
        }
      });
    }

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCurrentObservation();
    });
  },

  updateCategoryUI(category) {
    const panelNoise = document.getElementById('panel-noise-microphone');
    const panelLight = document.getElementById('panel-light-camera');
    const panelManual = document.getElementById('panel-manual-measurement');
    const sourceSensor = document.querySelector('input[name="source"][value="smartphone_sensor"]');
    const sourceCamera = document.querySelector('input[name="source"][value="camera"]');
    const sourceManual = document.querySelector('input[name="source"][value="manual"]');

    if (category === 'noise') {
      if (window.EcoSenseSensors) {
        window.EcoSenseSensors.stopMonitorCamera();
      }
      if (panelNoise) panelNoise.style.display = 'block';
      if (panelLight) panelLight.style.display = 'none';
      if (panelManual) panelManual.style.display = 'none';
      if (sourceSensor) sourceSensor.checked = true;

      const unitInput = document.getElementById('form-unit');
      if (unitInput) unitInput.value = 'dB (Est.)';
    } else if (category === 'light') {
      if (window.EcoSenseSensors) {
        window.EcoSenseSensors.stopMonitorMic();
      }
      if (panelNoise) panelNoise.style.display = 'none';
      if (panelLight) panelLight.style.display = 'block';
      if (panelManual) panelManual.style.display = 'none';
      if (sourceCamera) sourceCamera.checked = true;
      else if (sourceSensor) sourceSensor.checked = true;

      const unitInput = document.getElementById('form-unit');
      if (unitInput) unitInput.value = 'lux (Est.)';
    } else {
      // When user selects manual categories, stop both mic and camera
      if (window.EcoSenseSensors) {
        window.EcoSenseSensors.stopMonitorMic();
        window.EcoSenseSensors.stopMonitorCamera();
      }

      if (panelNoise) panelNoise.style.display = 'none';
      if (panelLight) panelLight.style.display = 'none';
      if (panelManual) panelManual.style.display = 'block';
      if (sourceManual) sourceManual.checked = true;

      this.updateFormUnitsForCategory(category);
    }
  },

  saveCurrentObservation() {
    const locationNameInput = document.getElementById('form-location-name');
    const locationName = (locationNameInput?.value || '').trim();
    const lat = document.getElementById('form-lat')?.value || '31.1471';
    const lng = document.getElementById('form-lng')?.value || '75.3412';
    const category = document.querySelector('input[name="category"]:checked')?.value || 'noise';
    const environment = document.getElementById('form-environment')?.value || 'outdoor';
    const weather = document.getElementById('form-weather')?.value || 'sunny';
    const timestamp = document.getElementById('form-datetime')?.value || new Date().toISOString();
    const notes = document.getElementById('form-notes')?.value || '';

    if (!locationName) {
      this.showToast('Please enter a Location Name for this observation', 'danger');
      if (locationNameInput) locationNameInput.focus();
      return false;
    }

    let value = '';
    let unit = '';
    let source = '';

    if (category === 'noise') {
      const liveVal = window.EcoSenseSensors?.monitorMic?.stats?.currentDb;
      const formVal = document.getElementById('form-value')?.value;
      const rawVal = liveVal || formVal;

      if (!rawVal || isNaN(parseFloat(rawVal)) || parseFloat(rawVal) <= 0) {
        this.showToast('Please click "Start Microphone" to analyze the ambient noise level first', 'danger');
        return false;
      }

      value = String(rawVal);
      unit = 'dB (Est.)';
      source = 'smartphone_sensor';
    } else if (category === 'light') {
      const liveLux = window.EcoSenseSensors?.monitorCamera?.stats?.currentLux;
      const formVal = document.getElementById('form-value')?.value;
      const rawVal = liveLux || formVal;

      if (!rawVal || isNaN(parseFloat(rawVal)) || parseFloat(rawVal) <= 0) {
        this.showToast('Please click "Start Camera" to analyze surrounding ambient brightness first', 'danger');
        return false;
      }

      value = String(rawVal);
      unit = 'lux (Est.)';
      source = 'camera';
    } else {
      value = (document.getElementById('form-value')?.value || '').trim();
      unit = (document.getElementById('form-unit')?.value || '').trim();
      source = document.querySelector('input[name="source"]:checked')?.value || 'manual';

      if (!value) {
        this.showToast('Please enter an observation value', 'danger');
        document.getElementById('form-value')?.focus();
        return false;
      }
    }

    const newObs = window.EcoSenseData.add({
      locationName,
      lat,
      lng,
      category,
      value,
      unit,
      source,
      environment,
      weather,
      timestamp,
      notes
    });

    const categoryTitle = category === 'noise' ? 'Noise Level' : category === 'light' ? 'Ambient Light' : category;
    this.showToast(`Recorded ${categoryTitle} observation (${value} ${unit})!`, 'success');

    // Stop microphone & camera after saving
    if (window.EcoSenseSensors) {
      window.EcoSenseSensors.stopMonitorMic();
      window.EcoSenseSensors.stopMonitorCamera();
    }

    // Refresh all dependent views (Dashboard, Map, Observations)
    this.refreshAllViews();

    // Reset fields
    if (locationNameInput) locationNameInput.value = '';
    const notesInput = document.getElementById('form-notes');
    if (notesInput) notesInput.value = '';

    // Route to Dashboard after 900ms so user can see their newly saved observation in the charts & table
    setTimeout(() => {
      this.navigateTo('dashboard');
    }, 900);

    return true;
  },

  updateFormUnitsForCategory(category) {
    const valInput = document.getElementById('form-value');
    const unitInput = document.getElementById('form-unit');
    const assistBox = document.getElementById('sensor-assist-container');

    const config = {
      noise: {
        unit: 'dB(A)',
        placeholder: 'e.g. 58.4',
        tip: 'Recommended range: 35 dB (quiet library) to 85 dB (busy cafeteria).',
        showMicBtn: true
      },
      light: {
        unit: 'lux',
        placeholder: 'e.g. 450',
        tip: 'Typical indoor desk: 300-500 lux. Direct sunlight: 20,000-100,000 lux.',
        showMicBtn: false
      },
      temperature: {
        unit: '°C',
        placeholder: 'e.g. 23.5',
        tip: 'Ambient surface or air temperature in Celsius.',
        showMicBtn: false
      },
      air_quality: {
        unit: 'AQI (Est.)',
        placeholder: 'e.g. 45',
        tip: 'US EPA AQI: 0-50 Good, 51-100 Moderate, 101-150 Unhealthy for sensitive groups.',
        showMicBtn: false
      },
      greenery: {
        unit: '% Canopy',
        placeholder: 'e.g. 75',
        tip: 'Estimated percentage of foliage/tree canopy coverage within a 20m radius.',
        showMicBtn: false
      },
      waste: {
        unit: 'Items / 50m²',
        placeholder: 'e.g. 8',
        tip: 'Tally of visible litter pieces (bottles, paper, plastics) in sample transect.',
        showMicBtn: false
      },
      other: {
        unit: 'Rating (1-10)',
        placeholder: 'e.g. 7',
        tip: 'Custom environmental observation metric.',
        showMicBtn: false
      }
    };

    const c = config[category] || config.other;
    if (unitInput) unitInput.value = c.unit;
    if (valInput) valInput.placeholder = c.placeholder;

    if (assistBox) {
      assistBox.innerHTML = `
        <div class="sensor-assist-text">
          <h5 id="manual-assist-title">${this.formatPageName(category)} Guideline</h5>
          <p id="manual-assist-desc">${c.tip}</p>
        </div>
      `;
    }
  },

  /* ========================================================
     DASHBOARD RENDERING
     ======================================================== */
  renderDashboard() {
    const stats = window.EcoSenseData.getStats();

    // KPI Cards
    const kpiTotal = document.getElementById('kpi-total-obs');
    const kpiTopCat = document.getElementById('kpi-top-category');
    const kpiAvgNoise = document.getElementById('kpi-avg-noise');
    const kpiSensorRatio = document.getElementById('kpi-sensor-ratio');

    if (kpiTotal) kpiTotal.textContent = stats.total;
    if (kpiTopCat) kpiTopCat.textContent = stats.topCategory;
    if (kpiAvgNoise) kpiAvgNoise.textContent = stats.avgNoise !== 'N/A' ? `${stats.avgNoise} dB` : 'N/A';
    if (kpiSensorRatio) kpiSensorRatio.textContent = `${stats.sensorRatio}%`;

    // Charts
    if (window.EcoSenseCharts) {
      window.EcoSenseCharts.renderCategoryChart('chart-categories-canvas', stats.categoryCounts);
      window.EcoSenseCharts.renderNoiseChart('chart-noise-canvas', window.EcoSenseData.getAll());
      window.EcoSenseCharts.renderSourceChart('chart-sources-canvas', stats);
    }

    // Recent items card deck
    const recentDeck = document.getElementById('recent-observations-deck');
    if (recentDeck) {
      if (!stats.recent.length) {
        recentDeck.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No observations recorded yet. Click "Start Monitoring" or "Load Demo Data".</div>`;
        return;
      }

      recentDeck.innerHTML = stats.recent.map(obs => {
        const timeAgo = this.formatTimeAgo(obs.timestamp);
        const catBadgeColor = window.EcoSenseMap?.categoryMeta[obs.category]?.color || '#059669';
        const isDemo = Boolean(obs.isDemo || (typeof obs.id === 'string' && obs.id.startsWith('demo-')));
        return `
          <div class="recent-item-card">
            <div class="recent-item-top">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span class="category-tag" style="background:${catBadgeColor}15; color:${catBadgeColor}; border:1px solid ${catBadgeColor}30;">
                  ${window.EcoSenseMap?.categoryMeta[obs.category]?.label || obs.category.replace('_', ' ')}
                </span>
                ${isDemo ? '<span style="background:#fef3c7; color:#92400e; font-size:0.68rem; font-weight:700; padding:1px 5px; border-radius:4px; border:1px solid #fde68a;">DEMO</span>' : '<span style="background:#d1fae5; color:#065f46; font-size:0.68rem; font-weight:700; padding:1px 5px; border-radius:4px; border:1px solid #a7f3d0;">LIVE</span>'}
              </div>
              <span class="source-badge ${obs.source === 'smartphone_sensor' || obs.source === 'camera' ? 'source-sensor' : ''}">
                ${obs.source === 'camera' ? '📷 Camera' : obs.source === 'smartphone_sensor' ? '📱 Sensor' : obs.source === 'manual' ? '✍️ Manual' : '🔌 External'}
              </span>
            </div>
            <div class="recent-item-location" title="${obs.locationName}">
              📍 ${obs.locationName}
            </div>
            <div class="recent-item-value">
              ${obs.value} <span style="font-size:0.85rem; color:#64748b;">${obs.unit}</span>
            </div>
            ${obs.notes ? `<p style="font-size:0.78rem; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${obs.notes}</p>` : ''}
            <div class="recent-item-footer">
              <span>🕒 ${timeAgo}</span>
              <a href="#map" data-nav-target="map" style="color:var(--primary); font-weight:600; text-decoration:none;">View Map &rarr;</a>
            </div>
          </div>
        `;
      }).join('');

      // Re-bind data-nav-target links inside recent deck
      recentDeck.querySelectorAll('[data-nav-target]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateTo(link.getAttribute('data-nav-target'));
        });
      });
    }
  },

  /* ========================================================
     OBSERVATIONS TABLE & SEARCH/FILTER
     ======================================================== */
  setupTableFilters() {
    const searchInput = document.getElementById('table-search-input');
    const catFilter = document.getElementById('table-category-filter');
    const sourceFilter = document.getElementById('table-source-filter');
    const sortFilter = document.getElementById('table-sort-filter');

    const triggerRender = () => this.renderObservationsTable();

    if (searchInput) searchInput.addEventListener('input', triggerRender);
    if (catFilter) catFilter.addEventListener('change', triggerRender);
    if (sourceFilter) sourceFilter.addEventListener('change', triggerRender);
    if (sortFilter) sortFilter.addEventListener('change', triggerRender);
  },

  renderObservationsTable() {
    const tbody = document.getElementById('observations-table-body');
    const countDisplay = document.getElementById('table-count-display');
    if (!tbody) return;

    const list = window.EcoSenseData.getAll();
    const searchVal = (document.getElementById('table-search-input')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('table-category-filter')?.value || 'all';
    const sourceVal = document.getElementById('table-source-filter')?.value || 'all';
    const sortVal = document.getElementById('table-sort-filter')?.value || 'newest';

    let filtered = list.filter(item => {
      // Search match
      const matchSearch = !searchVal ||
        (item.locationName || '').toLowerCase().includes(searchVal) ||
        (item.notes || '').toLowerCase().includes(searchVal) ||
        (item.value || '').toLowerCase().includes(searchVal) ||
        (item.category || '').toLowerCase().includes(searchVal);

      // Category match
      const matchCat = catVal === 'all' || item.category === catVal;

      // Source match
      const matchSource = sourceVal === 'all' || item.source === sourceVal;

      return matchSearch && matchCat && matchSource;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortVal === 'newest') return new Date(b.timestamp) - new Date(a.timestamp);
      if (sortVal === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
      if (sortVal === 'value') return parseFloat(b.value || 0) - parseFloat(a.value || 0);
      return 0;
    });

    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length} of ${list.length} observations`;
    }

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <h3>No matching observations found</h3>
              <p>Try adjusting your search query or filter criteria, or load demo observations.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((item, index) => {
      const meta = window.EcoSenseMap?.categoryMeta[item.category] || { color: '#059669', label: item.category };
      const dateStr = new Date(item.timestamp).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const isDemo = Boolean(item.isDemo || (typeof item.id === 'string' && item.id.startsWith('demo-')));

      return `
        <tr>
          <td><span style="color:#94a3b8; font-weight:600;">#${index + 1}</span></td>
          <td>
            <div style="font-weight:700; color:#0f172a; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span>${item.locationName}</span>
              ${isDemo ? '<span style="background:#fef3c7; color:#92400e; font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px; border:1px solid #fde68a;">DEMO</span>' : '<span style="background:#d1fae5; color:#065f46; font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px; border:1px solid #a7f3d0;">LIVE</span>'}
            </div>
            <div style="font-size:0.75rem; color:#64748b;">📍 ${parseFloat(item.lat).toFixed(4)}°, ${parseFloat(item.lng).toFixed(4)}°</div>
          </td>
          <td>
            <span class="category-tag" style="background:${meta.color}15; color:${meta.color}; border:1px solid ${meta.color}30;">
              ${meta.label || item.category}
            </span>
          </td>
          <td>
            <strong style="font-size:1.05rem; color:#0f172a;">${item.value}</strong>
            <span style="font-size:0.75rem; color:#64748b;">${item.unit}</span>
          </td>
          <td>
            <span class="source-badge ${item.source === 'smartphone_sensor' || item.source === 'camera' ? 'source-sensor' : ''}">
              ${item.source === 'camera' ? '📷 Camera' : item.source === 'smartphone_sensor' ? '📱 Sensor' : item.source === 'manual' ? '✍️ Manual' : '🔌 External'}
            </span>
          </td>
          <td style="font-size:0.8rem; color:#64748b;">${dateStr}</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="btn btn-sm btn-secondary" onclick="EcoSenseApp.viewOnMap('${item.id}')" title="Locate on Map">
                🗺️
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="EcoSenseApp.deleteObservation('${item.id}')" title="Delete observation">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  deleteObservation(id) {
    if (confirm('Are you sure you want to delete this environmental observation record?')) {
      window.EcoSenseData.delete(id);
      this.showToast('Observation deleted', 'success');
      this.refreshAllViews();
    }
  },

  viewOnMap(id) {
    this.navigateTo('map');
    this.applyMapViewMode('map_view');
    const obs = window.EcoSenseData.getAll().find(o => o.id === id);
    if (obs && window.EcoSenseMap) {
      setTimeout(() => {
        window.EcoSenseMap.focusObservation(obs);
      }, 200);
    }
  },

  /* ========================================================
     DEMO DATA & UTILITIES
     ======================================================== */
  setupDemoButtons() {
    // Top banner Demo Data button
    document.querySelectorAll('.btn-load-demo-data').forEach(btn => {
      btn.addEventListener('click', () => {
        window.EcoSenseData.resetToDemo();
        this.showToast('Loaded Punjab demonstration observations!', 'success');
        this.refreshAllViews();
      });
    });

    // Clear all data
    const btnClearAll = document.getElementById('btn-clear-all-data');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        if (confirm('Clear all observations from local storage?')) {
          window.EcoSenseData.clearAll();
          this.showToast('All observations cleared', 'danger');
          this.refreshAllViews();
        }
      });
    }

    // Export CSV
    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        const res = window.EcoSenseData.exportCSV();
        if (res) this.showToast('Exported dataset to CSV file', 'success');
        else this.showToast('No observations to export', 'danger');
      });
    }

    // Export JSON
    const btnExportJSON = document.getElementById('btn-export-json');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => {
        window.EcoSenseData.exportJSON();
        this.showToast('Exported dataset to JSON file', 'success');
      });
    }

    // Microphone Sensor testing on Device Sensors page
    const btnStartMicTest = document.getElementById('btn-start-mic-test');
    const btnStopMicTest = document.getElementById('btn-stop-mic-test');
    if (btnStartMicTest) {
      btnStartMicTest.addEventListener('click', () => {
        window.EcoSenseSensors.startAcousticSampling();
        btnStartMicTest.style.display = 'none';
        if (btnStopMicTest) btnStopMicTest.style.display = 'inline-flex';
      });
    }
    if (btnStopMicTest) {
      btnStopMicTest.addEventListener('click', () => {
        window.EcoSenseSensors.stopAcousticSampling();
        btnStopMicTest.style.display = 'none';
        if (btnStartMicTest) btnStartMicTest.style.display = 'inline-flex';
      });
    }

    // Copy live mic reading to record form
    const btnUseMicReading = document.getElementById('btn-use-mic-reading');
    if (btnUseMicReading) {
      btnUseMicReading.addEventListener('click', () => {
        const val = window.EcoSenseSensors.audioStats.currentDb || 55;
        this.navigateTo('record');
        const noiseRadio = document.querySelector('input[name="category"][value="noise"]');
        if (noiseRadio) {
          noiseRadio.checked = true;
          this.updateFormUnitsForCategory('noise');
        }
        document.getElementById('form-value').value = val;
        this.showToast(`Transferred live acoustic reading (${val} dB) to form!`, 'success');
      });
    }

    // GPS Sensor test button on Device Sensors page
    const btnTestGPS = document.getElementById('btn-test-gps-page');
    if (btnTestGPS) {
      btnTestGPS.addEventListener('click', async () => {
        btnTestGPS.disabled = true;
        btnTestGPS.innerHTML = 'Querying Location...';
        try {
          await window.EcoSenseSensors.getGPSLocation();
          this.showToast('GPS lock acquired successfully!', 'success');
        } catch (e) {
          this.showToast('GPS access denied or timed out.', 'danger');
        } finally {
          btnTestGPS.disabled = false;
          btnTestGPS.innerHTML = 'Acquire GPS Fix';
        }
      });
    }

    // Camera Preview Start / Stop
    const btnStartCam = document.getElementById('btn-start-camera-test');
    const btnStopCam = document.getElementById('btn-stop-camera-test');
    if (btnStartCam) {
      btnStartCam.addEventListener('click', async () => {
        const ok = await window.EcoSenseSensors.startCameraPreview();
        if (ok) {
          btnStartCam.style.display = 'none';
          if (btnStopCam) btnStopCam.style.display = 'inline-flex';
        }
      });
    }
    if (btnStopCam) {
      btnStopCam.addEventListener('click', () => {
        window.EcoSenseSensors.stopCameraPreview();
        btnStopCam.style.display = 'none';
        if (btnStartCam) btnStartCam.style.display = 'inline-flex';
      });
    }
  },

  /* ========================================================
     MAP & GPS CONTROLS ENGINE
     ======================================================== */
  setupMapAndGpsControls() {
    // 1. "Start / Detect Location" button in the GPS Hub
    const btnDetectGps = document.getElementById('btn-detect-gps-map');
    const elStatusDot = document.getElementById('gps-status-dot');
    const elStatusText = document.getElementById('gps-status-text');
    const elLat = document.getElementById('gps-live-lat');
    const elLng = document.getElementById('gps-live-lng');
    const elAcc = document.getElementById('gps-live-accuracy');
    const elTime = document.getElementById('gps-live-time');
    const btnUseForRecord = document.getElementById('btn-use-gps-for-record');
    const btnCenterGps = document.getElementById('btn-map-center-user-gps');

    if (btnDetectGps) {
      btnDetectGps.addEventListener('click', async () => {
        btnDetectGps.disabled = true;
        btnDetectGps.innerHTML = '<span>⏳ Querying Device GPS...</span>';
        if (elStatusDot) {
          elStatusDot.style.background = '#3b82f6';
          elStatusDot.style.boxShadow = '0 0 8px #3b82f6';
        }
        if (elStatusText) {
          elStatusText.textContent = 'Requesting browser geolocation permission (enable GPS on device)...';
          elStatusText.style.color = '#1d4ed8';
        }

        try {
          const loc = await window.EcoSenseSensors.getGPSLocation();
          if (elStatusDot) {
            elStatusDot.style.background = '#10b981';
            elStatusDot.style.boxShadow = '0 0 8px #10b981';
          }
          if (elStatusText) {
            elStatusText.textContent = `Location detected successfully (Real GPS Lock ±${loc.accuracy}m)`;
            elStatusText.style.color = '#065f46';
          }
          if (elLat) elLat.textContent = `${loc.lat.toFixed(5)}° N`;
          if (elLng) elLng.textContent = `${loc.lng.toFixed(5)}° E`;
          if (elAcc) elAcc.textContent = `±${loc.accuracy} m`;
          if (elTime) elTime.textContent = new Date().toLocaleTimeString();

          if (btnUseForRecord) btnUseForRecord.style.display = 'inline-flex';
          if (btnCenterGps) btnCenterGps.style.display = 'inline-flex';

          // Update vector map with pulsing beacon marker
          if (window.EcoSenseMap) {
            window.EcoSenseMap.setUserGps(loc);
          }

          this.showToast(`GPS Fix: ${loc.lat.toFixed(4)}° N, ${loc.lng.toFixed(4)}° E (±${loc.accuracy}m)`, 'success');
        } catch (err) {
          if (elStatusDot) {
            elStatusDot.style.background = '#ef4444';
            elStatusDot.style.boxShadow = '0 0 8px #ef4444';
          }
          if (elStatusText) {
            const isDenied = err && err.code === 1;
            elStatusText.textContent = isDenied
              ? 'Location permission denied. Please allow location access in your browser settings.'
              : 'GPS signal unavailable. Please ensure location services / GPS are active on your device.';
            elStatusText.style.color = '#991b1b';
          }
          if (elLat) elLat.textContent = 'Permission Denied';
          if (elLng) elLng.textContent = 'Not Available';
          if (elAcc) elAcc.textContent = 'Unavailable';
          if (elTime) elTime.textContent = '—';

          this.showToast(err.message || 'Could not fetch device location', 'danger');
        } finally {
          btnDetectGps.disabled = false;
          btnDetectGps.innerHTML = '<span>📍 Start / Detect Location</span>';
        }
      });
    }

    // 2. "Record With This Location" button
    if (btnUseForRecord) {
      btnUseForRecord.addEventListener('click', () => {
        const curLoc = window.EcoSenseSensors?.currentLocation;
        if (!curLoc) {
          this.showToast('Please detect your location first', 'danger');
          return;
        }

        const inputLat = document.getElementById('form-lat');
        const inputLng = document.getElementById('form-lng');
        const inputLoc = document.getElementById('form-location-name');

        if (inputLat) inputLat.value = curLoc.lat.toFixed(5);
        if (inputLng) inputLng.value = curLoc.lng.toFixed(5);
        if (inputLoc && !inputLoc.value.trim()) {
          inputLoc.value = `GPS Field Observation (${curLoc.lat.toFixed(4)}, ${curLoc.lng.toFixed(4)})`;
        }

        this.navigateTo('record');
        this.showToast('GPS coordinates applied to Record form', 'success');
      });
    }

    // 3. View Mode Switcher: Phagwara-Jalandhar Map vs GPS Location Card Only
    const btnToggleMap = document.getElementById('btn-toggle-view-map');
    const btnToggleGpsOnly = document.getElementById('btn-toggle-view-gpsonly');

    if (btnToggleMap) {
      btnToggleMap.addEventListener('click', () => {
        this.applyMapViewMode('map_view');
      });
    }
    if (btnToggleGpsOnly) {
      btnToggleGpsOnly.addEventListener('click', () => {
        this.applyMapViewMode('gps_only');
      });
    }

    // 4. Map Center Buttons
    const btnCenterPhagwara = document.getElementById('btn-map-center-phagwara');
    if (btnCenterPhagwara) {
      btnCenterPhagwara.addEventListener('click', () => {
        if (window.EcoSenseMap) window.EcoSenseMap.centerPhagwara();
      });
    }

    const btnCenterJalandhar = document.getElementById('btn-map-center-jalandhar');
    if (btnCenterJalandhar) {
      btnCenterJalandhar.addEventListener('click', () => {
        if (window.EcoSenseMap) window.EcoSenseMap.centerJalandhar();
      });
    }

    if (btnCenterGps) {
      btnCenterGps.addEventListener('click', () => {
        if (window.EcoSenseMap) window.EcoSenseMap.centerUserGps();
      });
    }

    const btnFitBounds = document.getElementById('btn-map-fit-bounds');
    if (btnFitBounds) {
      btnFitBounds.addEventListener('click', () => {
        if (window.EcoSenseMap) window.EcoSenseMap.fitAll();
      });
    }

    // 5. Map Category Filter Pills
    document.querySelectorAll('.map-filter-pill[data-map-cat]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.map-filter-pill[data-map-cat]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.getAttribute('data-map-cat');
        if (window.EcoSenseMap) {
          window.EcoSenseMap.setFilter(cat);
        }
      });
    });
  },

  applyMapViewMode(mode) {
    const mapWrapper = document.getElementById('map-visualization-wrapper');
    const btnMap = document.getElementById('btn-toggle-view-map');
    const btnGps = document.getElementById('btn-toggle-view-gpsonly');

    if (mode === 'gps_only') {
      if (mapWrapper) mapWrapper.style.display = 'none';
      if (btnMap) {
        btnMap.style.background = 'transparent';
        btnMap.style.color = '#64748b';
        btnMap.style.boxShadow = 'none';
        btnMap.style.fontWeight = '600';
      }
      if (btnGps) {
        btnGps.style.background = '#ffffff';
        btnGps.style.color = '#0f172a';
        btnGps.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        btnGps.style.fontWeight = '700';
      }
      localStorage.setItem('ecosense_map_view_mode', 'gps_only');
    } else {
      if (mapWrapper) mapWrapper.style.display = 'block';
      if (btnMap) {
        btnMap.style.background = '#ffffff';
        btnMap.style.color = '#0f172a';
        btnMap.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        btnMap.style.fontWeight = '700';
      }
      if (btnGps) {
        btnGps.style.background = 'transparent';
        btnGps.style.color = '#64748b';
        btnGps.style.boxShadow = 'none';
        btnGps.style.fontWeight = '600';
      }
      localStorage.setItem('ecosense_map_view_mode', 'map_view');
      if (window.EcoSenseMap) {
        setTimeout(() => window.EcoSenseMap.init('ecosense-map'), 50);
      }
    }
  },

  listenDataEvents() {
    window.addEventListener('ecosense:data_changed', () => {
      this.refreshAllViews();
    });
  },

  refreshAllViews() {
    this.renderDashboard();
    if (window.EcoSenseMap) {
      window.EcoSenseMap.renderMarkers();
    }
    this.renderObservationsTable();
  },

  formatTimeAgo(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  },

  /* ========================================================
     🌱 CITIZEN SCIENCE "I'M IN" PARTICIPATION FEATURE
     ======================================================== */
  setupParticipationFeature() {
    const btn = document.getElementById('btn-participate-im-in');
    const labelSpan = document.getElementById('btn-im-in-label');
    const iconSpan = document.getElementById('btn-im-in-icon');
    const countDisplay = document.getElementById('participant-count-display');
    const confMsg = document.getElementById('participation-confirmation-msg');
    const confIcon = document.getElementById('participation-confirmation-icon');
    const confText = document.getElementById('participation-confirmation-text');

    if (!btn || !countDisplay) return;

    const STORAGE_KEY_JOINED = 'ecosense_user_participated';
    const STORAGE_KEY_COUNT = 'ecosense_participant_cached_count';
    const API_BASE = 'https://countapi.mileshilliard.com/api/v1';
    const COUNTER_KEY = 'ecosense_punjab_citizens_v1';

    // Helper to format number
    const formatCount = (num) => {
      const n = parseInt(num, 10);
      return isNaN(n) ? '—' : n.toLocaleString();
    };

    // Helper to update counter UI and local cache
    const updateCountUI = (num) => {
      if (typeof num === 'number' && !isNaN(num) && num >= 0) {
        countDisplay.textContent = formatCount(num);
        try {
          localStorage.setItem(STORAGE_KEY_COUNT, String(num));
        } catch (e) {
          /* ignore storage quota */
        }
      }
    };

    // Check if user already joined
    const hasJoined = () => {
      try {
        return localStorage.getItem(STORAGE_KEY_JOINED) === 'true';
      } catch (e) {
        return false;
      }
    };

    // Set UI to "Joined" state
    const setJoinedUI = (isInitial = false) => {
      btn.classList.add('joined');
      if (iconSpan) iconSpan.textContent = '✓';
      if (labelSpan) labelSpan.textContent = '✓ I’m In';
      btn.setAttribute('aria-pressed', 'true');
      btn.title = 'You have already joined EcoSense Citizen Science';

      if (confMsg && confText) {
        confMsg.style.display = 'inline-flex';
        confMsg.classList.add('conf-already');
        if (confIcon) confIcon.textContent = isInitial ? '✓' : '🎉';
        confText.textContent = isInitial 
          ? 'You’re already participating.' 
          : 'You’re in! Welcome to EcoSense Citizen Science.';
      }
    };

    // 1. Initial cached value display (instant, zero flicker)
    let cachedCount = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COUNT);
      if (stored !== null) {
        cachedCount = parseInt(stored, 10);
        if (!isNaN(cachedCount)) {
          countDisplay.textContent = formatCount(cachedCount);
        }
      }
    } catch (e) {}

    // 2. Fetch live counter from online database
    const fetchLiveCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/get/${COUNTER_KEY}`, {
          method: 'GET',
          cache: 'no-cache'
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.value === 'number') {
            updateCountUI(data.value);
            return data.value;
          }
        }
      } catch (err) {
        // Fallback to cached count if network/offline
        if (cachedCount !== null) {
          updateCountUI(cachedCount);
        }
      }
      return null;
    };

    // 3. Check joined status on load
    if (hasJoined()) {
      setJoinedUI(true);
    }

    // 4. Load live count in background
    fetchLiveCount();

    // 5. Button click handler
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      // If user has already joined, prevent repeated increment
      if (hasJoined()) {
        if (confMsg && confText) {
          confMsg.style.display = 'inline-flex';
          confMsg.classList.add('conf-already');
          if (confIcon) confIcon.textContent = '✓';
          confText.textContent = 'You’re already participating.';
        }
        this.showToast('You are already participating in EcoSense Citizen Science!', 'info');
        return;
      }

      // Mark as joined locally immediately to prevent repeated participation
      try {
        localStorage.setItem(STORAGE_KEY_JOINED, 'true');
        localStorage.setItem('ecosense_user_participated_at', new Date().toISOString());
      } catch (err) {}

      // Update UI to joined state with confirmation message
      setJoinedUI(false);

      // Optimistically increment UI count
      let currentNum = parseInt(countDisplay.textContent.replace(/,/g, ''), 10);
      if (isNaN(currentNum)) {
        currentNum = cachedCount !== null ? cachedCount + 1 : 1;
      } else {
        currentNum += 1;
      }
      updateCountUI(currentNum);

      // Sync with online database backend
      try {
        const res = await fetch(`${API_BASE}/hit/${COUNTER_KEY}`, {
          method: 'GET',
          cache: 'no-cache'
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.value === 'number') {
            updateCountUI(data.value);
          }
        }
      } catch (err) {
        console.warn('EcoSense participant online sync deferred:', err);
      }

      this.showToast('You’re in! Welcome to EcoSense Citizen Science.', 'success');
    });
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'danger' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

window.EcoSenseApp = EcoSenseApp;

// Auto-boot application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.EcoSenseApp.init();
});
