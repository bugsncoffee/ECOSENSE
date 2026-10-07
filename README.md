# EcoSense 🌿
### Smartphone-Based Environmental Monitoring & Citizen Science Platform

---

## 📖 Project Overview

**EcoSense** is a modern, responsive citizen-science web application designed to demonstrate how everyday mobile smartphones can be converted into participatory environmental observers. By combining built-in hardware sensors (microphone, GPS, camera) with standardized citizen-science observation protocols, EcoSense allows users to record, map, and analyze localized environmental metrics across the state of **Punjab, India**.

---

## 🎯 Purpose of the Project

Traditional environmental monitoring relies on stationary, industrial-grade monitoring stations (e.g., CPCB continuous ambient air and noise stations). While highly accurate, these stations are expensive to install and maintain, resulting in sparse geographical coverage. 

EcoSense explores the potential and practical constraints of **participatory sensing**:
1. **Spatial Density:** Empowering citizens and students to contribute localized data points across cities, towns, transit corridors, and rural buffers.
2. **Environmental Awareness:** Providing instant feedback on everyday environmental phenomena such as acoustic noise pollution, daylight levels, canopy coverage, and waste accumulation.
3. **Open Citizen Science Data:** Aggregating crowdsourced records into an accessible, searchable archive that can be exported for academic analysis in spreadsheets, Python, or R.

---

## ✨ Main Features

### 1. Hardware Sensor Audit (`Device Sensors`)
* Conducts live, transparent checks of browser-accessible smartphone sensors:
  * **GPS / Geolocation API:** Real-time spatial coordinates (latitude, longitude, accuracy radius).
  * **Microphone / Web Audio API:** Real-time acoustic sampling and frequency spectrum monitoring.
  * **Camera / MediaDevices API:** Optical stream access for canopy and transect documentation.
  * **Ambient Light Sensor / Generic Sensor API:** Evaluates platform compatibility and explains W3C anti-fingerprinting permission restrictions.
* **Strict Honesty Policy:** Hardware sensors that are unsupported or restricted by browser security policies clearly display **"Not available"** rather than fabricating false measurements.

### 2. Live Acoustic Noise Meter (`Start Monitoring`)
* Continuous real-time ambient sound measurement via the device's microphone and browser Web Audio API (`AudioContext` + `AnalyserNode`).
* Computes Root Mean Square (RMS) energy to output an indicative decibel estimate (`dB Est.`).
* Displays a live color-coded VU meter bar (30 to 110 dB), dynamic environmental comfort classification (Quiet, Moderate, Elevated, Loud), statistical session metrics (Min, Avg, Max), and an animated oscilloscope waveform canvas.
* Includes an explicit scientific disclaimer noting that smartphone microphone readings are indicative estimates, not certified Type 1/Class 1 sound level measurements.

### 3. Live Optical Ambient Light Meter (`Start Monitoring`)
* Continuous real-time ambient brightness and luminance estimation via the smartphone's camera and `MediaDevices` API (`getUserMedia({ video: { facingMode: 'environment' } })`).
* Computes perceived photometric luminance across sampled video frames using standard ITU-R BT.709 weighting ($Y = 0.2126R + 0.7152G + 0.0722B$).
* Converts frame luminance to an indicative daylight illuminance reading (`lux Est.`), live visual reticle preview, dynamic qualitative badge (Low Light, Interior, Daylight, Solar Brightness), and min/avg/max session metrics.
* Clearly labeled as a camera-based indicative estimate, emphasizing academic limitations (hardware auto-exposure, aperture variances).

### 4. Multi-Domain Observation Form
* Supports six environmental monitoring categories:
  * **Acoustic Noise:** Smartphone microphone sensor integration.
  * **Ambient Light (camera estimate):** Optical camera luminance estimation.
  * **Temperature (°C):** Microclimate records.
  * **Air Quality (AQI):** Visual and sensory air pollution surveys.
  * **Greenery (%):** Canopy density and green-space audits.
  * **Waste & Litter:** Quantitative litter transect density counts.
* Automatic GPS tagging via browser Geolocation with manual coordinate override.
* Data persistence using HTML5 `localStorage`.

### 5. Analytical Dashboard
* Summary KPI cards: Total observations, top recorded category, average acoustic level, and sensor vs. manual contribution percentage.
* Interactive visualizations built with Chart.js (with offline-resilient HTML5 Canvas fallbacks):
  * Category distribution breakdown.
  * Acoustic sound levels across geographic locations.
  * Data acquisition source breakdown (Smartphone Sensor, Camera, Manual, External).
* Recent observations activity deck with status indicators.

### 6. Geographically Authentic Punjab State Map
* Interactive spatial map focused on the **entire State of Punjab, India**.
* Integrates authentic administrative boundaries for all 22 Punjab districts (Survey of India / Census 2011 DataMeet geographic data).
* Powered by Leaflet.js with reliable CartoDB Voyager tiles (suppressing 403 errors) and a built-in SVG vector fallback engine.
* Plots observation records with category-coded pins and detailed interactive popup cards.
* **Demonstration vs. Live Data Identification:** Demonstration data points are clearly tagged with amber badges (`DEMO`), while genuine recorded field observations are marked with emerald badges (`LIVE`).
* Map controls include category filtering, "Fit All Markers", and "Punjab Overview" zoom resets.
* Fully responsive across desktop and mobile devices.

### 7. Observations Archive & Data Export
* Searchable and filterable ledger of all saved observations.
* Instant filtering by search keyword, environmental category, data source, and sorting order.
* Individual record deletion and map locator shortcut.
* One-click data export to **CSV** and **JSON** formats for statistical analysis.

### 8. Scientific Limitations & Critical Evaluation
* In-depth documentation comparing consumer smartphone hardware with certified regulatory monitoring stations.
* Details hardware constraints including Automatic Gain Control (AGC), thermal dissipation bias, and consumer GPS multi-path reflection errors.

---

## 🔬 How the Environmental Monitoring Concept Works

1. **Acoustic Sensing (Microphone):**
   The browser captures an audio stream via `navigator.mediaDevices.getUserMedia({ audio: true })`. An `AudioContext` routes the signal through an `AnalyserNode` with Fast Fourier Transform (FFT) processing. The Root Mean Square (RMS) amplitude is calculated and converted to an indicative logarithmic decibel scale:
   $$\text{RMS} = \sqrt{\frac{1}{N}\sum_{i=1}^{N} x_i^2}$$
   $$\text{dB}_{\text{est}} \approx 20 \log_{10}(\text{RMS}) + \text{Calibration Offset}$$

2. **Optical Luminance Sensing (Camera):**
   The smartphone video stream is sampled in real time via an offscreen canvas. Perceived photometric luminance is computed from pixel buffer RGB values using ITU-R BT.709 coefficients:
   $$Y = 0.2126R + 0.7152G + 0.0722B$$
   This luminance value is mapped to an indicative illuminance range ($\text{lux}_{\text{est}}$) for comparative daylight appraisal.

3. **Spatial Tagging (Geolocation):**
   The W3C Geolocation API queries the device's GPS chip, Wi-Fi positioning, and cellular towers to obtain WGS84 decimal coordinates (`latitude`, `longitude`) alongside horizontal accuracy in meters.

4. **Data Verification & Tagging:**
   Observations recorded through live sensors or user entry are tagged with metadata (`isDemo: false`, timestamp, environmental context, source type) and persisted in browser storage. Built-in demonstration points for Punjab are explicitly marked (`isDemo: true`) to preserve scientific integrity.

---

## 🛠️ Technologies Used

* **Frontend Framework:** Semantic HTML5, Modern CSS3 (CSS Variables, Flexbox, Grid), Vanilla JavaScript (ES6+ Modules).
* **Audio & Hardware APIs:**
  * Web Audio API (`AudioContext`, `AnalyserNode`, `ScriptProcessorNode`/`createMediaStreamSource`).
  * MediaDevices API (`getUserMedia` for microphone and camera stream).
  * Geolocation API (`navigator.geolocation.getCurrentPosition`).
  * Generic Sensor API (`AmbientLightSensor` compatibility detection).
* **Data Visualization & Mapping:**
  * [Leaflet.js](https://leafletjs.com/) (v1.9.4) with CartoDB Voyager tiles.
  * Verified GeoJSON administrative boundaries for Punjab districts (Survey of India / Census 2011).
  * Offline-resilient SVG Punjab vector map engine.
  * [Chart.js](https://www.chartjs.org/) (v4.4.1) with responsive canvas charts.
* **Storage & Export:**
  * HTML5 `localStorage` API for client-side persistence.
  * Blob & URL API for CSV and JSON file generation.

---

## ⚠️ Important Limitations of Smartphone Sensing

| Environmental Domain | Smartphone Capability | Major Hardware Limitations | Regulatory Benchmark |
| :--- | :--- | :--- | :--- |
| **Acoustic Noise** | MEMS Microphone | Automatic Gain Control (AGC) alters audio sensitivity; frequency response is optimized for human voice (300 Hz–3.4 kHz); lacks physical windshield; uncalibrated sound pressure curve. | Type 1 / Class 1 Sound Level Meter ($\pm 0.5\text{ dB}$, IEC 61672-1) |
| **Spatial Position** | Consumer GPS / GNSS | Satellite multipath reflection around concrete buildings; horizontal drift of $\pm 3\text{m}$ to $15\text{m}$. | Real-Time Kinematic (RTK) Differential GPS ($< 2\text{ cm}$) |
| **Ambient Light** | Photodiode Sensor / CMOS Camera | Front photodiode restricted by browser anti-fingerprinting policies; camera-based optical luminance estimation is subject to hardware auto-exposure, variable aperture, and tone-mapping curves rather than direct physical lux. | Cosine-corrected Photometer |
| **Air Temperature** | Battery Thermistor | Measures internal device heat generated by CPU, battery, and screen, not ambient air temperature. | Aspirated Stevenson Screen Thermometer |
| **Air Quality (PM2.5/PM10)** | None (Hardware absent) | Smartphones do not have optical particle counters or laser scattering chambers; requires qualitative visual protocols or external sensors. | Beta Attenuation Monitor (BAM) / Gravimetric Reference |

---

## 💻 How to Run the Website Locally

Since EcoSense utilizes browser hardware APIs (Microphone and Camera), it is recommended to run the project via a local HTTP server rather than opening `file:///` directly:

### Method 1: Using Python (Recommended)
```bash
# Navigate to the project directory
cd ecosense

# Start a local web server on port 8000
python3 -m http.server 8000
```
Open your browser and visit: **[http://localhost:8000](http://localhost:8000)**

### Method 2: Using Node.js / NPX
```bash
npx serve .
# or
npx http-server -p 8000
```

### Method 3: Direct File Opening
Double-click `index.html` to open it in any modern browser (Google Chrome, Mozilla Firefox, Microsoft Edge, or Apple Safari). Note that some browsers restrict microphone and camera access on the `file://` protocol due to security sandbox policies.
