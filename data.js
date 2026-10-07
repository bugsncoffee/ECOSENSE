/**
 * EcoSense Data Management & LocalStorage Engine
 * Handles citizen-science observation records, demo campus data, and export utilities.
 */

const STORAGE_KEY = 'ecosense_observations_punjab_v2';
const LEGACY_STORAGE_KEY = 'ecosense_observations_punjab_v1';

// Demonstration environmental observations across the state of Punjab, India
// Clearly tagged with isDemo: true so the platform distinguishes demo data from real observations.
const SAMPLE_PUNJAB_OBSERVATIONS = [
  {
    id: "demo-punjab-101",
    isDemo: true,
    locationName: "Ludhiana (Industrial Focal Point Area)",
    lat: 30.9010,
    lng: 75.8573,
    category: "noise",
    value: "74.2",
    unit: "dB (Est.)",
    notes: "[Demonstration Data] Ambient acoustic sound estimate in commercial/industrial transit belt.",
    source: "smartphone_sensor",
    environment: "outdoor",
    weather: "sunny",
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
  },
  {
    id: "demo-punjab-102",
    isDemo: true,
    locationName: "Amritsar (Heritage Walk Corridor)",
    lat: 31.6200,
    lng: 74.8765,
    category: "noise",
    value: "68.5",
    unit: "dB (Est.)",
    notes: "[Demonstration Data] Pedestrian promenade ambient sound survey with evening visitor activity.",
    source: "smartphone_sensor",
    environment: "outdoor",
    weather: "clear",
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString()
  },
  {
    id: "demo-punjab-103",
    isDemo: true,
    locationName: "Jalandhar (Model Town Commercial Square)",
    lat: 31.3120,
    lng: 75.5815,
    category: "noise",
    value: "62.4",
    unit: "dB (Est.)",
    notes: "[Demonstration Data] Mixed retail corridor ambient noise during market transition interval.",
    source: "smartphone_sensor",
    environment: "outdoor",
    weather: "partly_cloudy",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: "demo-punjab-104",
    isDemo: true,
    locationName: "Patiala (Baradari Gardens Public Park)",
    lat: 30.3398,
    lng: 76.3869,
    category: "greenery",
    value: "86",
    unit: "% Canopy",
    notes: "[Demonstration Data] Urban park tree canopy assessment in historic public green space.",
    source: "manual",
    environment: "outdoor",
    weather: "sunny",
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  },
  {
    id: "demo-punjab-105",
    isDemo: true,
    locationName: "Bathinda (Thermal Lake & Promenade)",
    lat: 30.2110,
    lng: 74.9455,
    category: "temperature",
    value: "28.4",
    unit: "°C",
    notes: "[Demonstration Data] Thermal microclimate reading near waterfront open recreation buffer.",
    source: "external_sensor",
    environment: "outdoor",
    weather: "sunny",
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString()
  },
  {
    id: "demo-punjab-106",
    isDemo: true,
    locationName: "Phagwara (GT Road Highway Corridor)",
    lat: 31.2240,
    lng: 75.7708,
    category: "air_quality",
    value: "112",
    unit: "AQI (Est.)",
    notes: "[Demonstration Data] Indicative air quality estimate along Grand Trunk Road transit corridor.",
    source: "manual",
    environment: "outdoor",
    weather: "partly_cloudy",
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString()
  },
  {
    id: "demo-punjab-107",
    isDemo: true,
    locationName: "Mohali / SAS Nagar (Sector 62 IT City)",
    lat: 30.7046,
    lng: 76.7179,
    category: "light",
    value: "1450",
    unit: "lux (Est.)",
    notes: "[Demonstration Data] Ambient daylight brightness estimated via smartphone camera optical sensor.",
    source: "camera",
    environment: "outdoor",
    weather: "sunny",
    timestamp: new Date(Date.now() - 1000 * 60 * 380).toISOString()
  },
  {
    id: "demo-punjab-108",
    isDemo: true,
    locationName: "Hoshiarpur (Shivalik Foothills Agro-Forestry)",
    lat: 31.5273,
    lng: 75.9149,
    category: "greenery",
    value: "91",
    unit: "% Canopy",
    notes: "[Demonstration Data] Agro-ecological canopy survey in sub-Himalayan forest buffer zone.",
    source: "manual",
    environment: "outdoor",
    weather: "clear",
    timestamp: new Date(Date.now() - 1000 * 60 * 460).toISOString()
  }
];

const EcoSenseData = {
  /**
   * Retrieves all observations from localStorage.
   * If empty, initializes with sample demo data.
   */
  getAll() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Check if legacy storage key had user observations
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          try {
            const parsedLegacy = JSON.parse(legacy);
            if (Array.isArray(parsedLegacy)) {
              const userItems = parsedLegacy.filter(item => !item.isDemo);
              const migrated = [...userItems, ...SAMPLE_PUNJAB_OBSERVATIONS];
              this.saveAll(migrated);
              return migrated;
            }
          } catch (e) {
            console.warn("Could not parse legacy storage:", e);
          }
        }
        this.saveAll(SAMPLE_PUNJAB_OBSERVATIONS);
        return [...SAMPLE_PUNJAB_OBSERVATIONS];
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Error reading localStorage:", err);
      return [...SAMPLE_PUNJAB_OBSERVATIONS];
    }
  },

  /**
   * Overwrites all observations in localStorage.
   */
  saveAll(observations) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
      window.dispatchEvent(new CustomEvent('ecosense:data_changed', { detail: observations }));
      return true;
    } catch (err) {
      console.error("Error writing to localStorage:", err);
      return false;
    }
  },

  /**
   * Appends a new observation to localStorage.
   */
  add(record) {
    const list = this.getAll();
    const newRecord = {
      id: "obs-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      isDemo: false, // Mark user-recorded data as real observations
      timestamp: record.timestamp || new Date().toISOString(),
      locationName: record.locationName ? record.locationName.trim() : "Punjab Field Location",
      lat: parseFloat(record.lat) || 31.1471,
      lng: parseFloat(record.lng) || 75.3412,
      category: record.category || "noise",
      value: String(record.value || "").trim(),
      unit: record.unit || "dB(A)",
      notes: record.notes ? record.notes.trim() : "",
      source: record.source || "smartphone_sensor",
      environment: record.environment || "outdoor",
      weather: record.weather || "clear"
    };

    list.unshift(newRecord); // newest first
    this.saveAll(list);
    return newRecord;
  },

  /**
   * Removes an observation by ID.
   */
  delete(id) {
    const list = this.getAll();
    const filtered = list.filter(item => item.id !== id);
    this.saveAll(filtered);
    return filtered;
  },

  /**
   * Resets data to initial sample Punjab observations.
   */
  resetToDemo() {
    this.saveAll(SAMPLE_PUNJAB_OBSERVATIONS);
    return [...SAMPLE_PUNJAB_OBSERVATIONS];
  },

  /**
   * Clears all observations completely.
   */
  clearAll() {
    this.saveAll([]);
    return [];
  },

  /**
   * Computes aggregated stats for the Dashboard.
   */
  getStats() {
    const list = this.getAll();
    const total = list.length;
    
    // Category distribution
    const categoryCounts = {
      noise: 0,
      light: 0,
      temperature: 0,
      air_quality: 0,
      greenery: 0,
      waste: 0,
      other: 0
    };

    // Sources count
    let sensorCount = 0;
    let manualCount = 0;
    let externalCount = 0;

    let noiseSum = 0;
    let noiseN = 0;

    list.forEach(item => {
      const cat = (item.category || "other").toLowerCase();
      if (categoryCounts[cat] !== undefined) {
        categoryCounts[cat]++;
      } else {
        categoryCounts.other++;
      }

      if (item.source === 'smartphone_sensor' || item.source === 'camera') sensorCount++;
      else if (item.source === 'manual') manualCount++;
      else if (item.source === 'external_sensor') externalCount++;

      if (cat === 'noise') {
        const val = parseFloat(item.value);
        if (!isNaN(val) && val > 0) {
          noiseSum += val;
          noiseN++;
        }
      }
    });

    // Find top category
    let topCategory = "None";
    let topCategoryCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > topCategoryCount) {
        topCategoryCount = count;
        topCategory = cat.replace('_', ' ');
      }
    }

    const avgNoise = noiseN > 0 ? (noiseSum / noiseN).toFixed(1) : "N/A";

    return {
      total,
      categoryCounts,
      topCategory: topCategory.toUpperCase(),
      avgNoise,
      sensorRatio: total > 0 ? Math.round((sensorCount / total) * 100) : 0,
      sensorCount,
      manualCount,
      externalCount,
      recent: list.slice(0, 6)
    };
  },

  /**
   * Exports data to formatted CSV for academic analysis.
   */
  exportCSV() {
    const list = this.getAll();
    if (!list.length) return null;

    const headers = ["ID", "Timestamp (ISO)", "Location Name", "Latitude", "Longitude", "Category", "Value", "Unit", "Source", "Environment", "Weather", "Notes"];
    
    const rows = list.map(item => [
      `"${item.id}"`,
      `"${item.timestamp}"`,
      `"${(item.locationName || "").replace(/"/g, '""')}"`,
      item.lat,
      item.lng,
      `"${item.category}"`,
      `"${item.value}"`,
      `"${item.unit}"`,
      `"${item.source}"`,
      `"${item.environment || ''}"`,
      `"${item.weather || ''}"`,
      `"${(item.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecosense_environmental_data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Exports data as formatted JSON.
   */
  exportJSON() {
    const list = this.getAll();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `ecosense_observations_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }
};

window.EcoSenseData = EcoSenseData;
