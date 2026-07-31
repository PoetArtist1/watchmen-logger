/** Chart.js helpers — Signal Desk palette */

const INK = '#102224';
const TEAL = '#1f8a7a';
const SIGNAL = '#ff4d2e';
const SAND = '#c98512';
const BLUE = '#1d4e89';

const chartRefs = new Map();

function destroy(key) {
  const existing = chartRefs.get(key);
  if (existing) {
    existing.destroy();
    chartRefs.delete(key);
  }
}

export function destroyAllCharts() {
  for (const key of [...chartRefs.keys()]) destroy(key);
}

export function renderMethodChart(canvas, byMethod = {}) {
  if (!canvas || typeof Chart === 'undefined') return;
  destroy('method');
  const labels = Object.keys(byMethod);
  const data = Object.values(byMethod);
  chartRefs.set('method', new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [TEAL, BLUE, SAND, SIGNAL, '#7a4db0', INK],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: INK,
            font: { family: 'IBM Plex Mono', size: 11 }
          }
        }
      }
    }
  }));
}

export function renderStatusChart(canvas, byStatus = {}) {
  if (!canvas || typeof Chart === 'undefined') return;
  destroy('status');
  const order = ['2xx', '3xx', '4xx', '5xx'];
  chartRefs.set('status', new Chart(canvas, {
    type: 'bar',
    data: {
      labels: order,
      datasets: [{
        data: order.map((k) => byStatus[k] || 0),
        backgroundColor: [TEAL, BLUE, SAND, SIGNAL],
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: INK, font: { family: 'IBM Plex Mono', size: 11 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: INK, font: { family: 'IBM Plex Mono', size: 11 } },
          grid: { color: 'rgba(16,34,36,0.08)' }
        }
      }
    }
  }));
}

export function renderTimelineChart(canvas, timeline = []) {
  if (!canvas || typeof Chart === 'undefined') return;
  destroy('timeline');
  const labels = timeline.map((p) => {
    const d = new Date(p.timestamp);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  chartRefs.set('timeline', new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'req/min',
          data: timeline.map((p) => p.count),
          borderColor: TEAL,
          backgroundColor: 'rgba(31,138,122,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        },
        {
          label: 'avg latency',
          data: timeline.map((p) => p.avg_latency || 0),
          borderColor: SIGNAL,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: INK, font: { family: 'IBM Plex Mono', size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: {
            color: INK,
            maxTicksLimit: 8,
            font: { family: 'IBM Plex Mono', size: 10 }
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: INK, font: { family: 'IBM Plex Mono', size: 10 } },
          grid: { color: 'rgba(16,34,36,0.08)' }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          ticks: { color: SIGNAL, font: { family: 'IBM Plex Mono', size: 10 } },
          grid: { drawOnChartArea: false }
        }
      }
    }
  }));
}