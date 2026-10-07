/**
 * EcoSense Chart Visualizations Engine
 * Renders category breakdowns, noise levels, and source distributions.
 * Supports Chart.js and includes a built-in pure HTML5 Canvas fallback for full offline reliability.
 */

const EcoSenseCharts = {
  instances: {},

  colors: {
    noise: '#ea580c',
    light: '#eab308',
    temperature: '#e11d48',
    air_quality: '#0284c7',
    greenery: '#16a34a',
    waste: '#9333ea',
    other: '#64748b'
  },

  destroyChart(id) {
    if (this.instances[id]) {
      if (typeof this.instances[id].destroy === 'function') {
        this.instances[id].destroy();
      }
      delete this.instances[id];
    }
  },

  /**
   * 1. Category Distribution Doughnut Chart
   */
  renderCategoryChart(canvasId, counts) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = ['Noise', 'Ambient Light', 'Temperature', 'Air Quality', 'Greenery', 'Waste', 'Other'];
    const keys = ['noise', 'light', 'temperature', 'air_quality', 'greenery', 'waste', 'other'];
    const data = keys.map(k => counts[k] || 0);
    const bgColors = keys.map(k => this.colors[k]);

    // Check if Chart.js is available via CDN
    if (window.Chart) {
      try {
        const ctx = canvas.getContext('2d');
        this.instances[canvasId] = new window.Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: bgColors,
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  boxWidth: 12,
                  font: { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", size: 11 },
                  color: '#475569'
                }
              },
              tooltip: {
                callbacks: {
                  label: function(item) {
                    const total = item.dataset.data.reduce((a, b) => a + b, 0);
                    const val = item.raw;
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return ` ${item.label}: ${val} (${pct}%)`;
                  }
                }
              }
            },
            cutout: '62%'
          }
        });
        return;
      } catch (e) {
        console.warn('Chart.js render failed, falling back to canvas', e);
      }
    }

    // Pure Canvas fallback
    this.drawFallbackDoughnut(canvas, labels, data, bgColors);
  },

  /**
   * 2. Campus Sound / Noise Level Bar Chart
   */
  renderNoiseChart(canvasId, observations) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const noiseItems = observations
      .filter(o => o.category === 'noise' && parseFloat(o.value) > 0)
      .slice(0, 7);

    const labels = noiseItems.map(o => {
      const name = o.locationName || 'Location';
      return name.length > 18 ? name.substr(0, 16) + '...' : name;
    });
    const values = noiseItems.map(o => parseFloat(o.value));

    if (window.Chart) {
      try {
        const ctx = canvas.getContext('2d');
        this.instances[canvasId] = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels.length ? labels : ['No Noise Data'],
            datasets: [{
              label: 'Acoustic Level (dB)',
              data: values.length ? values : [0],
              backgroundColor: values.map(v => v > 75 ? '#ef4444' : v > 60 ? '#f59e0b' : '#10b981'),
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                suggestedMax: 100,
                title: { display: true, text: 'Decibels (dB A)', color: '#64748b', font: { size: 11 } }
              },
              x: {
                ticks: { font: { size: 10 }, color: '#475569' }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
        return;
      } catch (e) {
        console.warn('Chart.js render failed, using canvas fallback', e);
      }
    }

    this.drawFallbackBar(canvas, labels, values);
  },

  /**
   * 3. Source Breakdown Polar/Bar Chart (Sensor vs Manual)
   */
  renderSourceChart(canvasId, stats) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = ['Smartphone Sensors (Mic / Camera)', 'Manual Citizen Entry', 'External Sensor'];
    const data = [stats.sensorCount || 0, stats.manualCount || 0, stats.externalCount || 0];
    const colors = ['#059669', '#3b82f6', '#8b5cf6'];

    if (window.Chart) {
      try {
        const ctx = canvas.getContext('2d');
        this.instances[canvasId] = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: colors,
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
        return;
      } catch (e) {
        console.warn(e);
      }
    }

    this.drawFallbackBarHorizontal(canvas, labels, data, colors);
  },

  /* ========================================================
     CANVAS FALLBACK ENGINES (Works 100% with no internet)
     ======================================================== */
  drawFallbackDoughnut(canvas, labels, data, colors) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 300;
    const height = canvas.height = 240;
    ctx.clearRect(0, 0, width, height);

    const total = data.reduce((a, b) => a + b, 0);
    const centerX = width * 0.4;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = radius * 0.6;

    if (total === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillText('No observations recorded', width / 2, height / 2);
      return;
    }

    let currentAngle = -0.5 * Math.PI;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) continue;
      const sliceAngle = (data[i] / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      currentAngle += sliceAngle;
    }

    // Legend on the right
    let legendY = 30;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < labels.length; i++) {
      if (data[i] === 0) continue;
      ctx.fillStyle = colors[i];
      ctx.fillRect(width * 0.72, legendY, 10, 10);
      ctx.fillStyle = '#334155';
      ctx.fillText(`${labels[i]}: ${data[i]}`, width * 0.72 + 16, legendY + 9);
      legendY += 20;
    }
  },

  drawFallbackBar(canvas, labels, values) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 300;
    const height = canvas.height = 240;
    ctx.clearRect(0, 0, width, height);

    if (!values.length || values.every(v => v === 0)) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillText('No noise data recorded', width / 2, height / 2);
      return;
    }

    const padding = 35;
    const maxVal = Math.max(...values, 80);
    const barWidth = Math.min(36, (width - padding * 2) / values.length - 8);

    for (let i = 0; i < values.length; i++) {
      const barHeight = (values[i] / maxVal) * (height - padding * 2);
      const x = padding + i * (barWidth + 12);
      const y = height - padding - barHeight;

      ctx.fillStyle = values[i] > 75 ? '#ef4444' : values[i] > 60 ? '#f59e0b' : '#10b981';
      ctx.fillRect(x, y, barWidth, barHeight);

      // Value label on top
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${values[i]}dB`, x + barWidth / 2, y - 4);
    }
  },

  drawFallbackBarHorizontal(canvas, labels, data, colors) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth || 300;
    const height = canvas.height = 240;
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...data, 1);
    const startY = 30;
    const barHeight = 26;

    for (let i = 0; i < labels.length; i++) {
      const y = startY + i * 50;
      const barWidth = (data[i] / maxVal) * (width - 160);

      ctx.fillStyle = '#334155';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(labels[i], 16, y - 6);

      ctx.fillStyle = colors[i] || '#059669';
      ctx.fillRect(16, y, Math.max(4, barWidth), barHeight);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(data[i], 24 + Math.max(4, barWidth), y + 17);
    }
  }
};

window.EcoSenseCharts = EcoSenseCharts;
