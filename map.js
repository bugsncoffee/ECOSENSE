/**
 * EcoSense Phagwara & Jalandhar Regional Vector Map Engine
 * 
 * 100% self-contained geographic vector cartography covering:
 * - Phagwara, Punjab, India (31.2240° N, 75.7708° E)
 * - Jalandhar, Punjab, India (31.3260° N, 75.5762° E)
 * - Lovely Professional University (LPU) campus corridor (31.2530° N, 75.7035° E)
 * - Grand Trunk Road (NH 44 / Old NH 1) arterial transit highway
 * 
 * ZERO external tile requests — 100% immune to 403 "Access blocked" errors.
 * Plots real GPS coordinates, observation records, category filters, and interactive popups.
 */

const EcoSenseMap = {
  containerId: 'ecosense-map',
  currentCategoryFilter: 'all',
  userGpsLocation: null,
  activePopupObsId: null,
  viewCenterMode: 'corridor', // 'corridor', 'phagwara', 'jalandhar', 'user_gps', 'all'

  // Authentic Coordinates for Key Regional Hubs
  PHAGWARA_COORDS: { lat: 31.2240, lng: 75.7708, label: 'Phagwara City Center' },
  JALANDHAR_COORDS: { lat: 31.3260, lng: 75.5762, label: 'Jalandhar City Center' },
  LPU_COORDS: { lat: 31.2530, lng: 75.7035, label: 'Lovely Professional University (LPU)' },
  CANTT_COORDS: { lat: 31.2950, lng: 75.6200, label: 'Jalandhar Cantt' },
  RAMA_MANDI_COORDS: { lat: 31.3100, lng: 75.6350, label: 'Rama Mandi' },
  CHAHERU_COORDS: { lat: 31.2650, lng: 75.6850, label: 'Chaheru' },
  SATNAMPURA_COORDS: { lat: 31.2320, lng: 75.7620, label: 'Satnampura' },

  // Default Regional Bounding Box (Phagwara – Jalandhar Corridor)
  DEFAULT_BOUNDS: {
    minLat: 31.1400,
    maxLat: 31.3800,
    minLng: 75.4800,
    maxLng: 75.8600
  },

  categoryMeta: {
    noise: { color: '#ea580c', icon: '🔊', label: 'Noise' },
    light: { color: '#eab308', icon: '☀️', label: 'Ambient Light (camera estimate)' },
    temperature: { color: '#e11d48', icon: '🌡️', label: 'Temperature' },
    air_quality: { color: '#0284c7', icon: '💨', label: 'Air Quality' },
    greenery: { color: '#16a34a', icon: '🌿', label: 'Greenery' },
    waste: { color: '#9333ea', icon: '🗑️', label: 'Waste/Litter' },
    other: { color: '#64748b', icon: '📍', label: 'Other' }
  },

  init(containerId = 'ecosense-map') {
    this.containerId = containerId;
    this.render();
    this.setupEventListeners();
  },

  setupEventListeners() {
    window.addEventListener('resize', () => {
      // Re-render when container size changes
      if (document.getElementById(this.containerId)) {
        this.render();
      }
    });

    // Listen to data change events
    window.addEventListener('ecosense:data_changed', () => {
      this.render();
    });
  },

  setFilter(category) {
    this.currentCategoryFilter = category;
    this.render();
  },

  setUserGps(location) {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return;
    this.userGpsLocation = {
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy || 10,
      timestamp: location.timestamp || new Date().toISOString()
    };

    // Make the "My GPS Fix" button visible in the map controls
    const btnCenterGps = document.getElementById('btn-map-center-user-gps');
    if (btnCenterGps) btnCenterGps.style.display = 'inline-flex';

    this.render();
  },

  centerPhagwara() {
    this.viewCenterMode = 'phagwara';
    this.render();
  },

  centerJalandhar() {
    this.viewCenterMode = 'jalandhar';
    this.render();
  },

  centerUserGps() {
    if (!this.userGpsLocation) return;
    this.viewCenterMode = 'user_gps';
    this.render();
  },

  fitAll() {
    this.viewCenterMode = 'all';
    this.render();
  },

  focusObservation(obs) {
    if (!obs) return;
    this.activePopupObsId = obs.id;
    this.render();

    // Scroll to map smoothly
    const container = document.getElementById(this.containerId);
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  closePopup() {
    this.activePopupObsId = null;
    this.render();
  },

  // Calculate Geodesic Distance in km (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  },

  /**
   * Calculates effective geographic bounds based on center mode and data
   */
  calculateEffectiveBounds(observations) {
    const base = { ...this.DEFAULT_BOUNDS };

    if (this.viewCenterMode === 'phagwara') {
      return {
        minLat: 31.1800,
        maxLat: 31.2700,
        minLng: 75.7200,
        maxLng: 75.8200
      };
    }

    if (this.viewCenterMode === 'jalandhar') {
      return {
        minLat: 31.2700,
        maxLat: 31.3700,
        minLng: 75.5200,
        maxLng: 75.6500
      };
    }

    if (this.viewCenterMode === 'user_gps' && this.userGpsLocation) {
      const uLat = this.userGpsLocation.lat;
      const uLng = this.userGpsLocation.lng;
      // If user is near Phagwara/Jalandhar, show corridor with user in focus
      const latSpan = 0.08;
      const lngSpan = 0.12;
      return {
        minLat: uLat - latSpan,
        maxLat: uLat + latSpan,
        minLng: uLng - lngSpan,
        maxLng: uLng + lngSpan
      };
    }

    if (this.viewCenterMode === 'all') {
      const allLats = observations.map(o => parseFloat(o.lat)).filter(n => !isNaN(n));
      const allLngs = observations.map(o => parseFloat(o.lng)).filter(n => !isNaN(n));
      if (this.userGpsLocation) {
        allLats.push(this.userGpsLocation.lat);
        allLngs.push(this.userGpsLocation.lng);
      }
      // Include key corridor coordinates so landmarks are always present
      allLats.push(this.PHAGWARA_COORDS.lat, this.JALANDHAR_COORDS.lat, this.LPU_COORDS.lat);
      allLngs.push(this.PHAGWARA_COORDS.lng, this.JALANDHAR_COORDS.lng, this.LPU_COORDS.lng);

      const minLat = Math.min(...allLats) - 0.03;
      const maxLat = Math.max(...allLats) + 0.03;
      const minLng = Math.min(...allLngs) - 0.04;
      const maxLng = Math.max(...allLngs) + 0.04;
      return { minLat, maxLat, minLng, maxLng };
    }

    // Default corridor view: if user GPS is available and within reasonable distance, slightly expand bounds to encompass it
    if (this.userGpsLocation) {
      const uLat = this.userGpsLocation.lat;
      const uLng = this.userGpsLocation.lng;
      // If user is in Punjab region (lat 29.5-32.5, lng 73.8-77.0)
      if (uLat >= 29.5 && uLat <= 32.5 && uLng >= 73.8 && uLng <= 77.0) {
        base.minLat = Math.min(base.minLat, uLat - 0.02);
        base.maxLat = Math.max(base.maxLat, uLat + 0.02);
        base.minLng = Math.min(base.minLng, uLng - 0.02);
        base.maxLng = Math.max(base.maxLng, uLng + 0.02);
      }
    }

    return base;
  },

  /**
   * Main Render Method — Generates 100% SVG Vector Cartography (Zero Tile Requests)
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const allObservations = window.EcoSenseData ? window.EcoSenseData.getAll() : [];
    const filteredObservations = this.currentCategoryFilter === 'all'
      ? allObservations
      : allObservations.filter(o => o.category === this.currentCategoryFilter);

    // Update filter counter banner
    const counterEl = document.getElementById('map-point-counter');
    if (counterEl) {
      counterEl.textContent = `Showing ${filteredObservations.length} Observations • Zero Tile Requests (100% Reliable)`;
    }

    const bounds = this.calculateEffectiveBounds(filteredObservations);
    const { minLat, maxLat, minLng, maxLng } = bounds;

    // Canvas coordinate space
    const SVG_W = 1000;
    const SVG_H = 640;

    // Mathematical projection helper (WGS84 Lat/Lng to SVG X/Y)
    const project = (lat, lng) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * SVG_W;
      const y = SVG_H - ((lat - minLat) / (maxLat - minLat)) * SVG_H;
      return [x, y];
    };

    // Highway NH 44 (Grand Trunk Road) corridor points
    const nh44Coords = [
      [31.3500, 75.5450], // Entering from North Jalandhar
      [31.3380, 75.5620], // Jalandhar North
      [31.3260, 75.5762], // Jalandhar City Center (Bus Stand / Railway)
      [31.3100, 75.6350], // PAP Chowk & Rama Mandi
      [31.2950, 75.6200], // Jalandhar Cantt Flyover
      [31.2800, 75.6550], // Dakoha / Chiheru Link
      [31.2650, 75.6850], // Chaheru Bridge & Railway crossing
      [31.2530, 75.7035], // Lovely Professional University (LPU Main Gate Corridor)
      [31.2400, 75.7350], // Konica / Law Gate corridor
      [31.2320, 75.7620], // Satnampura North Phagwara
      [31.2240, 75.7708], // Phagwara City Center (GT Road Junction)
      [31.2100, 75.7820], // Phagwara South (Sugar Mill corridor)
      [31.1850, 75.8050], // Heading South toward Goraya & Ludhiana
      [31.1600, 75.8300]
    ];

    const nh44PathD = nh44Coords
      .map(([lat, lng], idx) => {
        const [x, y] = project(lat, lng);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    // Connecting State Highway 24 (Hoshiarpur Road) from Rama Mandi heading NE
    const sh24Coords = [
      [31.3100, 75.6350],
      [31.3350, 75.6700],
      [31.3650, 75.7100],
      [31.3950, 75.7500]
    ];
    const sh24PathD = sh24Coords.map(([lat, lng], idx) => {
      const [x, y] = project(lat, lng);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // Connecting Nakodar Road (NH 703) heading SW from Jalandhar
    const nh703Coords = [
      [31.3260, 75.5762],
      [31.2950, 75.5350],
      [31.2650, 75.5000],
      [31.2350, 75.4650]
    ];
    const nh703PathD = nh703Coords.map(([lat, lng], idx) => {
      const [x, y] = project(lat, lng);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // Kapurthala Road heading NW from Jalandhar
    const kapurthalaRoadCoords = [
      [31.3260, 75.5762],
      [31.3450, 75.5300],
      [31.3650, 75.4800]
    ];
    const kapurthalaPathD = kapurthalaRoadCoords.map(([lat, lng], idx) => {
      const [x, y] = project(lat, lng);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // Phagwara Ring Bypass (NH 344A / Urban Ring)
    const phagwaraBypassCoords = [
      [31.2400, 75.7350],
      [31.2500, 75.7700],
      [31.2420, 75.8050],
      [31.2100, 75.8000],
      [31.1850, 75.8050]
    ];
    const phagwaraBypassPathD = phagwaraBypassCoords.map(([lat, lng], idx) => {
      const [x, y] = project(lat, lng);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // District Boundary (Jalandhar vs Kapurthala/Phagwara) running roughly along longitude 75.67
    const districtBorderCoords = [
      [31.3800, 75.6600],
      [31.3400, 75.6650],
      [31.3000, 75.6750],
      [31.2700, 75.6780],
      [31.2400, 75.6820],
      [31.2000, 75.6850],
      [31.1500, 75.6900]
    ];
    const districtBorderPathD = districtBorderCoords.map(([lat, lng], idx) => {
      const [x, y] = project(lat, lng);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

    // Urban Polygons
    // 1. Jalandhar Urban Agglomeration Footprint
    const [jalX, jalY] = project(this.JALANDHAR_COORDS.lat, this.JALANDHAR_COORDS.lng);
    // 2. Phagwara Urban Footprint
    const [phagX, phagY] = project(this.PHAGWARA_COORDS.lat, this.PHAGWARA_COORDS.lng);
    // 3. LPU Campus Footprint
    const [lpuX, lpuY] = project(this.LPU_COORDS.lat, this.LPU_COORDS.lng);
    // 4. Jalandhar Cantt
    const [canttX, canttY] = project(this.CANTT_COORDS.lat, this.CANTT_COORDS.lng);
    // 5. Rama Mandi
    const [ramaX, ramaY] = project(this.RAMA_MANDI_COORDS.lat, this.RAMA_MANDI_COORDS.lng);
    // 6. Chaheru
    const [chaheruX, chaheruY] = project(this.CHAHERU_COORDS.lat, this.CHAHERU_COORDS.lng);

    // Coordinate Grid Graticule (Lat/Lng reference lines)
    const latLines = [];
    for (let lat = 31.15; lat <= 31.38; lat += 0.05) {
      if (lat >= minLat && lat <= maxLat) {
        const [, y] = project(lat, minLng);
        latLines.push({ lat, y });
      }
    }

    const lngLines = [];
    for (let lng = 75.50; lng <= 75.85; lng += 0.05) {
      if (lng >= minLng && lng <= maxLng) {
        const [x] = project(minLat, lng);
        lngLines.push({ lng, x });
      }
    }

    // NH 44 Label placement (midpoint between LPU and Chaheru)
    const [nh44MidX, nh44MidY] = project(31.2590, 75.6940);

    // Find active popup observation if present
    const activeObs = this.activePopupObsId
      ? allObservations.find(o => o.id === this.activePopupObsId)
      : null;

    // Render Full SVG & Container HTML
    container.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; min-height: 560px; background: #f8fafc; overflow: hidden; border-radius: var(--radius-lg); user-select: none;">
        
        <!-- Cartographic Vector SVG Layer (Zero Network Requests) -->
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%; display: block; background: #f8fafc;">
          <defs>
            <!-- Drop Shadow for Pins -->
            <filter id="map-pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.35"/>
            </filter>
            <!-- GPS Pulse Ring Animation Gradient -->
            <radialGradient id="gps-pulse-grad">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.6"/>
              <stop offset="70%" stop-color="#2563eb" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0"/>
            </radialGradient>
            <!-- Road patterns -->
            <linearGradient id="nh44-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fbbf24"/>
              <stop offset="100%" stop-color="#f59e0b"/>
            </linearGradient>
          </defs>

          <!-- 1. Coordinate Graticule Grid Lines (Lat / Lng) -->
          <g opacity="0.45">
            ${latLines.map(l => `
              <line x1="0" y1="${l.y.toFixed(1)}" x2="${SVG_W}" y2="${l.y.toFixed(1)}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,6" />
              <text x="12" y="${(l.y - 4).toFixed(1)}" font-size="11" font-family="-apple-system, sans-serif" font-weight="600" fill="#94a3b8">${l.lat.toFixed(2)}° N</text>
            `).join('')}

            ${lngLines.map(l => `
              <line x1="${l.x.toFixed(1)}" y1="0" x2="${l.x.toFixed(1)}" y2="${SVG_H}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,6" />
              <text x="${(l.x + 4).toFixed(1)}" y="${SVG_H - 10}" font-size="11" font-family="-apple-system, sans-serif" font-weight="600" fill="#94a3b8">${l.lng.toFixed(2)}° E</text>
            `).join('')}
          </g>

          <!-- 2. District Administrative Boundary Line -->
          <path d="${districtBorderPathD}" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="8,6" opacity="0.75" />
          <text x="${(project(31.3550, 75.6550)[0])}" y="${(project(31.3550, 75.6550)[1])}" font-size="11" font-family="-apple-system, sans-serif" font-weight="700" fill="#64748b" transform="rotate(-78, ${(project(31.3550, 75.6550)[0])}, ${(project(31.3550, 75.6550)[1])})">
            ◀ JALANDHAR DISTRICT | KAPURTHALA DISTRICT (PHAGWARA) ▶
          </text>

          <!-- 3. Regional Highway Network -->
          <!-- Secondary Arteries Casing -->
          <path d="${sh24PathD}" fill="none" stroke="#e2e8f0" stroke-width="7" stroke-linecap="round"/>
          <path d="${sh24PathD}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>

          <path d="${nh703PathD}" fill="none" stroke="#e2e8f0" stroke-width="7" stroke-linecap="round"/>
          <path d="${nh703PathD}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>

          <path d="${kapurthalaPathD}" fill="none" stroke="#e2e8f0" stroke-width="7" stroke-linecap="round"/>
          <path d="${kapurthalaPathD}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>

          <path d="${phagwaraBypassPathD}" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round"/>
          <path d="${phagwaraBypassPathD}" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-dasharray="6,4"/>

          <!-- Grand Trunk Road (NH 44 / Old NH 1) Main Arterial Corridor -->
          <path d="${nh44PathD}" fill="none" stroke="#cbd5e1" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${nh44PathD}" fill="none" stroke="url(#nh44-fill)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>

          <!-- 4. Urban Area Polygons -->
          <!-- Jalandhar Urban Agglomeration -->
          <ellipse cx="${jalX.toFixed(1)}" cy="${jalY.toFixed(1)}" rx="65" ry="45" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" opacity="0.85"/>

          <!-- Phagwara Urban Area -->
          <ellipse cx="${phagX.toFixed(1)}" cy="${phagY.toFixed(1)}" rx="52" ry="38" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" opacity="0.85"/>

          <!-- Lovely Professional University (LPU Campus Grounds) -->
          <rect x="${(lpuX - 44).toFixed(1)}" y="${(lpuY - 32).toFixed(1)}" width="88" height="64" rx="10" fill="#ecfdf5" stroke="#10b981" stroke-width="2" opacity="0.9"/>
          
          <!-- 5. Geographical Labels & Route Badges -->
          <!-- Jalandhar Label -->
          <g transform="translate(${jalX.toFixed(1)}, ${(jalY - 20).toFixed(1)})" text-anchor="middle">
            <rect x="-70" y="-14" width="140" height="24" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="1.2" filter="url(#map-pin-shadow)"/>
            <text x="0" y="2" font-size="12" font-family="-apple-system, sans-serif" font-weight="800" fill="#0f172a">🏢 JALANDHAR CITY</text>
          </g>

          <!-- Phagwara Label -->
          <g transform="translate(${phagX.toFixed(1)}, ${(phagY - 20).toFixed(1)})" text-anchor="middle">
            <rect x="-68" y="-14" width="136" height="24" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="1.2" filter="url(#map-pin-shadow)"/>
            <text x="0" y="2" font-size="12" font-family="-apple-system, sans-serif" font-weight="800" fill="#0f172a">📍 PHAGWARA CITY</text>
          </g>

          <!-- Lovely Professional University (LPU Campus) Label -->
          <g transform="translate(${lpuX.toFixed(1)}, ${(lpuY - 14).toFixed(1)})" text-anchor="middle">
            <rect x="-82" y="-14" width="164" height="26" rx="6" fill="#047857" stroke="#ffffff" stroke-width="1.5" filter="url(#map-pin-shadow)"/>
            <text x="0" y="3" font-size="11" font-family="-apple-system, sans-serif" font-weight="800" fill="#ffffff">🎓 LPU CAMPUS (CHAHERU)</text>
          </g>

          <!-- Jalandhar Cantt Label -->
          <g transform="translate(${canttX.toFixed(1)}, ${(canttY + 16).toFixed(1)})" text-anchor="middle">
            <rect x="-56" y="-11" width="112" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <text x="0" y="3" font-size="10" font-family="-apple-system, sans-serif" font-weight="700" fill="#475569">🚂 Jalandhar Cantt</text>
          </g>

          <!-- Rama Mandi Label -->
          <g transform="translate(${ramaX.toFixed(1)}, ${(ramaY - 14).toFixed(1)})" text-anchor="middle">
            <rect x="-50" y="-10" width="100" height="19" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <text x="0" y="3" font-size="9.5" font-family="-apple-system, sans-serif" font-weight="700" fill="#475569">📍 Rama Mandi</text>
          </g>

          <!-- Chaheru Label -->
          <g transform="translate(${chaheruX.toFixed(1)}, ${(chaheruY + 18).toFixed(1)})" text-anchor="middle">
            <rect x="-44" y="-10" width="88" height="19" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <text x="0" y="3" font-size="9.5" font-family="-apple-system, sans-serif" font-weight="700" fill="#475569">📍 Chaheru</text>
          </g>

          <!-- NH 44 Highway Badge along the route -->
          <g transform="translate(${nh44MidX.toFixed(1)}, ${nh44MidY.toFixed(1)})" text-anchor="middle">
            <rect x="-58" y="-11" width="116" height="22" rx="11" fill="#1e293b" stroke="#fbbf24" stroke-width="1.8" filter="url(#map-pin-shadow)"/>
            <text x="0" y="4" font-size="10" font-family="-apple-system, sans-serif" font-weight="800" fill="#fbbf24">🛣️ NH 44 (GT ROAD)</text>
          </g>

          <!-- Road Directional Badges -->
          <!-- Toward Amritsar -->
          <g transform="translate(45, 40)">
            <text x="0" y="0" font-size="11" font-family="-apple-system, sans-serif" font-weight="700" fill="#64748b">◀ Towards Amritsar (NH 44)</text>
          </g>
          <!-- Toward Ludhiana -->
          <g transform="translate(${SVG_W - 190}, ${SVG_H - 35})">
            <text x="0" y="0" font-size="11" font-family="-apple-system, sans-serif" font-weight="700" fill="#64748b">Towards Ludhiana (NH 44) ▶</text>
          </g>
          <!-- Toward Hoshiarpur -->
          <g transform="translate(${SVG_W - 170}, 40)">
            <text x="0" y="0" font-size="11" font-family="-apple-system, sans-serif" font-weight="700" fill="#64748b">▲ Towards Hoshiarpur (SH 24)</text>
          </g>

          <!-- Cartographic Distance Scale Bar (Bottom Left) -->
          <g transform="translate(30, ${SVG_H - 45})">
            <rect x="0" y="-8" width="140" height="24" rx="5" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" stroke-width="1"/>
            <line x1="12" y1="4" x2="128" y2="4" stroke="#0f172a" stroke-width="3"/>
            <line x1="12" y1="0" x2="12" y2="8" stroke="#0f172a" stroke-width="2"/>
            <line x1="70" y1="1" x2="70" y2="7" stroke="#0f172a" stroke-width="1.5"/>
            <line x1="128" y1="0" x2="128" y2="8" stroke="#0f172a" stroke-width="2"/>
            <text x="12" y="-12" font-size="9.5" font-family="-apple-system, sans-serif" font-weight="700" fill="#334155">0</text>
            <text x="65" y="-12" font-size="9.5" font-family="-apple-system, sans-serif" font-weight="700" fill="#334155">5 km</text>
            <text x="116" y="-12" font-size="9.5" font-family="-apple-system, sans-serif" font-weight="700" fill="#334155">10 km</text>
          </g>

          <!-- Compass Rose (Top Right) -->
          <g transform="translate(${SVG_W - 46}, 48)">
            <circle cx="0" cy="0" r="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#map-pin-shadow)"/>
            <polygon points="0,-12 4,0 0,2 -4,0" fill="#ef4444"/>
            <polygon points="0,12 4,0 0,2 -4,0" fill="#94a3b8"/>
            <text x="0" y="-14" font-size="9" font-family="-apple-system, sans-serif" font-weight="900" fill="#0f172a" text-anchor="middle">N</text>
          </g>
        </svg>

        <!-- Dynamic Overlay: Observation Pins & Real GPS Marker -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
          
          <!-- Plotted Observations -->
          ${filteredObservations.map(item => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lng);
            if (isNaN(lat) || isNaN(lng)) return '';

            // Calculate percentage position
            const leftPct = Math.min(96, Math.max(4, ((lng - minLng) / (maxLng - minLng)) * 100));
            const topPct = Math.min(96, Math.max(4, (1 - (lat - minLat) / (maxLat - minLat)) * 100));

            const meta = this.categoryMeta[item.category] || this.categoryMeta.other;
            const isDemo = Boolean(item.isDemo || (typeof item.id === 'string' && item.id.startsWith('demo-')));
            const isSelected = item.id === this.activePopupObsId;

            return `
              <div 
                class="ecosense-vector-pin"
                onclick="EcoSenseMap.focusObservation(EcoSenseData.getAll().find(o => o.id === '${item.id}'))"
                style="
                  position: absolute;
                  left: ${leftPct.toFixed(2)}%;
                  top: ${topPct.toFixed(2)}%;
                  transform: translate(-50%, -50%) ${isSelected ? 'scale(1.2)' : ''};
                  z-index: ${isSelected ? '35' : '20'};
                  pointer-events: auto;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 5px;
                  background: ${meta.color};
                  color: #ffffff;
                  padding: 4px 9px;
                  border-radius: 20px;
                  border: 2px solid #ffffff;
                  box-shadow: 0 4px 10px rgba(0,0,0,0.35);
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  font-size: 11px;
                  font-weight: 700;
                  white-space: nowrap;
                  transition: transform 0.15s ease, box-shadow 0.15s ease;
                "
                title="${item.locationName} (${item.value} ${item.unit})"
                onmouseover="this.style.transform='translate(-50%, -50%) scale(1.15)'; this.style.zIndex='30';"
                onmouseout="this.style.transform='translate(-50%, -50%) ${isSelected ? 'scale(1.2)' : 'scale(1)'}'; this.style.zIndex='${isSelected ? '35' : '20'}';"
              >
                <span>${meta.icon}</span>
                <span>${item.value} <small style="font-size: 8.5px; opacity: 0.9;">${item.unit}</small></span>
                ${isDemo ? `
                  <span style="background: #d97706; color: #fff; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 4px; margin-left: 2px; border: 1px solid rgba(255,255,255,0.4);">DEMO</span>
                ` : `
                  <span style="background: #059669; color: #fff; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 4px; margin-left: 2px; border: 1px solid rgba(255,255,255,0.4);">LIVE</span>
                `}
              </div>
            `;
          }).join('')}

          <!-- Actual Device GPS Marker (When Detected) -->
          ${this.userGpsLocation ? (() => {
            const uLat = this.userGpsLocation.lat;
            const uLng = this.userGpsLocation.lng;
            const uAcc = this.userGpsLocation.accuracy || 10;
            const leftPct = Math.min(96, Math.max(4, ((uLng - minLng) / (maxLng - minLng)) * 100));
            const topPct = Math.min(96, Math.max(4, (1 - (uLat - minLat) / (maxLat - minLat)) * 100));

            const distPhag = this.calculateDistance(uLat, uLng, this.PHAGWARA_COORDS.lat, this.PHAGWARA_COORDS.lng);
            const distJal = this.calculateDistance(uLat, uLng, this.JALANDHAR_COORDS.lat, this.JALANDHAR_COORDS.lng);

            return `
              <div 
                style="
                  position: absolute;
                  left: ${leftPct.toFixed(2)}%;
                  top: ${topPct.toFixed(2)}%;
                  transform: translate(-50%, -50%);
                  z-index: 40;
                  pointer-events: auto;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                "
              >
                <!-- Animated Beacon Radar Wave -->
                <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                  <span style="
                    position: absolute;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(37, 99, 235, 0.35);
                    animation: radar-beacon-pulse 1.8s infinite ease-out;
                  "></span>
                  <div style="
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #2563eb;
                    border: 3px solid #ffffff;
                    box-shadow: 0 0 12px rgba(37, 99, 235, 0.8);
                    z-index: 2;
                  "></div>
                </div>

                <!-- GPS Callout Label -->
                <div style="
                  margin-top: 4px;
                  background: #1e3a8a;
                  color: #ffffff;
                  padding: 4px 10px;
                  border-radius: 12px;
                  border: 1.5px solid #60a5fa;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  font-family: -apple-system, sans-serif;
                  font-size: 11px;
                  font-weight: 800;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 1px;
                  white-space: nowrap;
                ">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span>🎯</span>
                    <span>YOU ARE HERE (Real GPS)</span>
                  </div>
                  <span style="font-size: 9px; color: #bfdbfe; font-weight: 600;">
                    ${uLat.toFixed(5)}° N, ${uLng.toFixed(5)}° E (±${uAcc}m)
                  </span>
                  <span style="font-size: 8.5px; color: #93c5fd; font-weight: 500;">
                    ${distPhag} km to Phagwara • ${distJal} km to Jalandhar
                  </span>
                </div>
              </div>
            `;
          })() : ''}

          <!-- Interactive Popup Card for Selected Observation -->
          ${activeObs ? (() => {
            const lat = parseFloat(activeObs.lat);
            const lng = parseFloat(activeObs.lng);
            const leftPct = Math.min(85, Math.max(15, ((lng - minLng) / (maxLng - minLng)) * 100));
            const topPct = Math.min(85, Math.max(15, (1 - (lat - minLat) / (maxLat - minLat)) * 100));
            const meta = this.categoryMeta[activeObs.category] || this.categoryMeta.other;
            const isDemo = Boolean(activeObs.isDemo || (typeof activeObs.id === 'string' && activeObs.id.startsWith('demo-')));

            return `
              <div 
                style="
                  position: absolute;
                  left: ${leftPct.toFixed(2)}%;
                  top: ${topPct.toFixed(2)}%;
                  transform: translate(-50%, -105%);
                  z-index: 50;
                  pointer-events: auto;
                  background: #ffffff;
                  border-radius: 12px;
                  padding: 14px 16px;
                  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
                  border: 1px solid #e2e8f0;
                  min-width: 240px;
                  max-width: 300px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                "
              >
                <!-- Popup Close Button -->
                <button 
                  onclick="EcoSenseMap.closePopup()" 
                  style="position: absolute; top: 8px; right: 8px; border: none; background: #f1f5f9; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 13px; font-weight: bold; color: #64748b; display: flex; align-items: center; justify-content: center;"
                >×</button>

                <!-- Status Banner -->
                ${isDemo ? `
                  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 3px 8px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 4px;">
                    <span style="font-size: 11px;">⚠️</span>
                    <span style="font-size: 10px; font-weight: 800; color: #92400e;">DEMONSTRATION RECORD</span>
                  </div>
                ` : `
                  <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 3px 8px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 4px;">
                    <span style="font-size: 11px;">✅</span>
                    <span style="font-size: 10px; font-weight: 800; color: #065f46;">RECORDED FIELD OBSERVATION</span>
                  </div>
                `}

                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <span style="background: ${meta.color}; color: #fff; font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 10px; text-transform: uppercase;">
                    ${meta.label}
                  </span>
                  <span style="font-size: 10px; color: #64748b;">
                    ${activeObs.source === 'camera' ? '📷 Camera' : activeObs.source === 'smartphone_sensor' ? '📱 Sensor' : activeObs.source === 'manual' ? '✍️ Manual' : '🔌 External'}
                  </span>
                </div>

                <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">
                  ${activeObs.locationName}
                </div>

                <div style="font-size: 19px; font-weight: 800; color: ${meta.color}; margin: 4px 0;">
                  ${activeObs.value} <span style="font-size: 12px; color: #64748b;">${activeObs.unit}</span>
                </div>

                ${activeObs.notes ? `
                  <p style="font-size: 11px; color: #475569; margin: 6px 0; background: #f8fafc; padding: 6px 8px; border-radius: 6px; border-left: 3px solid ${meta.color}; line-height: 1.4;">
                    ${activeObs.notes}
                  </p>
                ` : ''}

                <div style="font-size: 10.5px; color: #94a3b8; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <span>📍 ${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span>
                  <span>${new Date(activeObs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            `;
          })() : ''}

        </div>
      </div>
    `;
  }
};

window.EcoSenseMap = EcoSenseMap;
