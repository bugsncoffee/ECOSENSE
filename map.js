/**
 * EcoSense Interactive Environmental Map Engine
 * Displays spatial observations with category-coded pins, popups, and filtering.
 * Uses Leaflet.js with an interactive SVG/Canvas Campus Map fallback for 100% offline resilience.
 */

const EcoSenseMap = {
  mapInstance: null,
  markersLayer: null,
  currentCategoryFilter: 'all',

  categoryMeta: {
    noise: { color: '#ea580c', icon: '🔊', label: 'Noise' },
    light: { color: '#eab308', icon: '☀️', label: 'Light' },
    temperature: { color: '#e11d48', icon: '🌡️', label: 'Temperature' },
    air_quality: { color: '#0284c7', icon: '💨', label: 'Air Quality' },
    greenery: { color: '#16a34a', icon: '🌿', label: 'Greenery' },
    waste: { color: '#9333ea', icon: '🗑️', label: 'Waste/Litter' },
    other: { color: '#64748b', icon: '📍', label: 'Other' }
  },

  init(containerId = 'ecosense-map') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Check if Leaflet L is available
    if (window.L) {
      try {
        if (!this.mapInstance) {
          this.mapInstance = L.map(containerId, {
            center: [37.7749, -122.4194],
            zoom: 16,
            zoomControl: true
          });

          // OpenStreetMap standard tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors | EcoSense Environmental Project',
            maxZoom: 19
          }).addTo(this.mapInstance);

          this.markersLayer = L.layerGroup().addTo(this.mapInstance);
        }

        this.renderMarkers();
        // Invalidate size when tab becomes visible
        setTimeout(() => {
          if (this.mapInstance) this.mapInstance.invalidateSize();
        }, 200);
        return;
      } catch (err) {
        console.warn('Leaflet map initialization failed, using vector canvas fallback', err);
      }
    }

    // Fallback vector map
    this.renderVectorFallback(containerId);
  },

  setFilter(category) {
    this.currentCategoryFilter = category;
    this.renderMarkers();
  },

  renderMarkers() {
    const observations = window.EcoSenseData ? window.EcoSenseData.getAll() : [];
    
    if (this.mapInstance && window.L && this.markersLayer) {
      this.markersLayer.clearLayers();
      const bounds = [];

      observations.forEach(item => {
        if (this.currentCategoryFilter !== 'all' && item.category !== this.currentCategoryFilter) {
          return;
        }

        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        const meta = this.categoryMeta[item.category] || this.categoryMeta.other;

        // Custom circular marker icon with category color & emoji
        const customIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `<div style="
            background: ${meta.color};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.15s ease;
          " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
            ${meta.icon}
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const popupContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 200px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span style="background:${meta.color}; color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:12px; text-transform:uppercase;">
                ${meta.label}
              </span>
              <span style="font-size:11px; color:#64748b;">
                ${item.source === 'smartphone_sensor' ? '📱 Sensor' : item.source === 'manual' ? '✍️ Manual' : '🔌 External'}
              </span>
            </div>
            <div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:2px;">
              ${item.locationName}
            </div>
            <div style="font-size:18px; font-weight:800; color:${meta.color}; margin: 4px 0;">
              ${item.value} <span style="font-size:12px; color:#64748b;">${item.unit}</span>
            </div>
            ${item.notes ? `<p style="font-size:12px; color:#475569; margin:4px 0; background:#f8fafc; padding:6px; border-radius:4px; border-left:2px solid ${meta.color};">${item.notes}</p>` : ''}
            <div style="font-size:11px; color:#94a3b8; margin-top:6px;">
              📍 ${lat.toFixed(4)}°, ${lng.toFixed(4)}° • ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: customIcon }).bindPopup(popupContent);
        this.markersLayer.addLayer(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length > 0) {
        this.mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
      return;
    }

    // Otherwise render vector fallback
    this.renderVectorFallback('ecosense-map');
  },

  /**
   * Fallback visualizer if internet or Leaflet tiles are unavailable
   */
  renderVectorFallback(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const observations = window.EcoSenseData ? window.EcoSenseData.getAll() : [];
    const filtered = this.currentCategoryFilter === 'all'
      ? observations
      : observations.filter(o => o.category === this.currentCategoryFilter);

    container.innerHTML = `
      <div style="position:relative; width:100%; height:100%; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); display:flex; flex-direction:column; overflow:hidden;">
        <div style="padding:12px 16px; background:rgba(255,255,255,0.9); border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; font-weight:700; color:#0f172a;">
            🗺️ College Campus Spatial Grid (Simulated Coordinate Plane)
          </div>
          <div style="font-size:11px; color:#64748b;">
            Plotted Observations: ${filtered.length}
          </div>
        </div>
        <div style="position:relative; flex:1; margin:16px; border:2px dashed #94a3b8; border-radius:8px; background:#f8fafc; overflow:hidden;" id="vector-canvas-box">
          <div style="position:absolute; top:12px; left:12px; font-size:11px; font-weight:600; color:#64748b; background:rgba(255,255,255,0.85); padding:4px 8px; border-radius:4px;">
            Science Quad & Green Spaces Area
          </div>
          ${filtered.map((item, idx) => {
            const meta = this.categoryMeta[item.category] || this.categoryMeta.other;
            // Generate deterministic relative coordinates around center
            const leftPct = 15 + ((Math.abs(item.lng * 1000) % 70));
            const topPct = 15 + ((Math.abs(item.lat * 1000) % 70));
            return `
              <div style="
                position: absolute;
                left: ${leftPct}%;
                top: ${topPct}%;
                transform: translate(-50%, -50%);
                background: ${meta.color};
                color: #fff;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
                box-shadow: 0 3px 8px rgba(0,0,0,0.2);
                border: 2px solid white;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                z-index: 5;
              " title="${item.locationName}: ${item.value} ${item.unit}">
                <span>${meta.icon}</span>
                <span>${item.value} ${item.unit}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  fitAll() {
    if (this.mapInstance && this.markersLayer) {
      const bounds = [];
      this.markersLayer.eachLayer(layer => {
        if (layer.getLatLng) bounds.push(layer.getLatLng());
      });
      if (bounds.length) {
        this.mapInstance.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }
};

window.EcoSenseMap = EcoSenseMap;
