/**
 * charts.js
 * Renders 3 charts (Donut, Stacked Bar, Projection Line) using Chart.js v4
 * and chartjs-plugin-annotation. Exposed via window.Charts namespace.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------
  var _instances = []; // keep references so we can destroy them later

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatCurrency(value) {
    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  /** Safely check that Chart.js is available */
  function chartReady() {
    if (typeof Chart === 'undefined') {
      console.error('[charts.js] Chart.js is not loaded. Make sure the CDN script is included before charts.js.');
      return false;
    }
    return true;
  }

  /** Register the annotation plugin once (safe to call multiple times) */
  var _annotationRegistered = false;
  function ensureAnnotationPlugin() {
    if (_annotationRegistered) return;
    if (typeof ChartAnnotation !== 'undefined') {
      Chart.register(ChartAnnotation);
      _annotationRegistered = true;
    } else if (
      typeof window['chartjs-plugin-annotation'] !== 'undefined'
    ) {
      Chart.register(window['chartjs-plugin-annotation']);
      _annotationRegistered = true;
    }
    // The plugin may auto-register itself; nothing else to do.
  }

  /**
   * Destroy any existing Chart instance that is bound to the given canvas,
   * then remove it from our internal tracking array.
   */
  function destroyByCanvas(canvasId) {
    _instances = _instances.filter(function (inst) {
      if (inst.canvas && inst.canvas.id === canvasId) {
        inst.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Shared font defaults.
   */
  var FONT_FAMILY = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";

  // ---------------------------------------------------------------------------
  // Brand palette
  // ---------------------------------------------------------------------------
  var COLOR = {
    orange:        '#E37627',
    orangeLight:   '#FC832B',
    orangeLighter: '#FD964B',
    black:         '#000000',
    gray:          '#9CA3AF',
    white:         '#FFFFFF'
  };

  // ---------------------------------------------------------------------------
  // Chart 1 : Cost Breakdown Donut
  // ---------------------------------------------------------------------------
  function renderDonut(canvasId, data) {
    if (!chartReady()) return null;
    destroyByCanvas(canvasId);

    var ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.error('[charts.js] Canvas #' + canvasId + ' not found.');
      return null;
    }

    var total = (data.labor || 0) + (data.fuel || 0) + (data.equipment || 0);

    var chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Labor', 'Fuel', 'Equipment'],
        datasets: [{
          data: [data.labor || 0, data.fuel || 0, data.equipment || 0],
          backgroundColor: [COLOR.orange, COLOR.orangeLight, COLOR.black],
          borderColor: COLOR.white,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        animation: {
          animateRotate: true,
          animateScale: true
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: FONT_FAMILY, size: 13 },
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 12
            }
          },
          tooltip: {
            titleFont: { family: FONT_FAMILY },
            bodyFont: { family: FONT_FAMILY },
            callbacks: {
              label: function (context) {
                var label = context.label || '';
                var value = context.parsed || 0;
                return label + ': ' + formatCurrency(value);
              }
            }
          }
        }
      },
      plugins: [{
        // Center text plugin (total)
        id: 'donutCenterText',
        afterDraw: function (chart) {
          var width  = chart.width;
          var height = chart.height;
          var ctxDraw = chart.ctx;

          ctxDraw.save();
          var fontSize = Math.min(width, height) / 10;
          ctxDraw.font = '600 ' + fontSize + 'px ' + FONT_FAMILY;
          ctxDraw.fillStyle = COLOR.black;
          ctxDraw.textAlign = 'center';
          ctxDraw.textBaseline = 'middle';

          var labelFontSize = fontSize * 0.5;
          var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

          // "Total" label
          ctxDraw.font = '400 ' + labelFontSize + 'px ' + FONT_FAMILY;
          ctxDraw.fillStyle = COLOR.gray;
          ctxDraw.fillText('Total', centerX, centerY - fontSize * 0.55);

          // Dollar amount
          ctxDraw.font = '700 ' + fontSize + 'px ' + FONT_FAMILY;
          ctxDraw.fillStyle = COLOR.black;
          ctxDraw.fillText(formatCurrency(total), centerX, centerY + fontSize * 0.35);

          ctxDraw.restore();
        }
      }]
    });

    _instances.push(chart);
    return chart;
  }

  // ---------------------------------------------------------------------------
  // Chart 2 : Before vs After Stacked Bar
  // ---------------------------------------------------------------------------
  function renderComparison(canvasId, currentCosts, automatedCosts) {
    if (!chartReady()) return null;
    destroyByCanvas(canvasId);

    var ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.error('[charts.js] Canvas #' + canvasId + ' not found.');
      return null;
    }

    var categories = [
      { key: 'labor',       label: 'Labor',              color: COLOR.orange },
      { key: 'fuel',        label: 'Fuel',               color: COLOR.orangeLight },
      { key: 'equipment',   label: 'Equipment',          color: COLOR.black },
      { key: 'maintenance', label: 'Robotic Maintenance', color: COLOR.orangeLighter },
      { key: 'electricity', label: 'Electricity',        color: COLOR.gray }
    ];

    var datasets = categories.map(function (cat) {
      return {
        label: cat.label,
        data: [
          currentCosts[cat.key]   || 0,
          automatedCosts[cat.key] || 0
        ],
        backgroundColor: cat.color,
        borderColor: COLOR.white,
        borderWidth: 1,
        borderRadius: 2
      };
    });

    var chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Current', 'Automated'],
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: FONT_FAMILY, size: 12 },
              padding: 14,
              usePointStyle: true,
              pointStyleWidth: 12
            }
          },
          tooltip: {
            titleFont: { family: FONT_FAMILY },
            bodyFont: { family: FONT_FAMILY },
            callbacks: {
              label: function (context) {
                var label = context.dataset.label || '';
                var value = context.parsed.y || 0;
                return label + ': ' + formatCurrency(value);
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              font: { family: FONT_FAMILY, size: 13 }
            },
            grid: {
              display: false
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              font: { family: FONT_FAMILY, size: 11 },
              callback: function (value) {
                return formatCurrency(value);
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.06)'
            }
          }
        }
      }
    });

    _instances.push(chart);
    return chart;
  }

  // ---------------------------------------------------------------------------
  // Chart 3 : 5-Year Cumulative Projection Line
  // ---------------------------------------------------------------------------
  function renderProjection(canvasId, projection, paybackYear) {
    if (!chartReady()) return null;
    ensureAnnotationPlugin();
    destroyByCanvas(canvasId);

    var ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.error('[charts.js] Canvas #' + canvasId + ' not found.');
      return null;
    }

    var labels = projection.map(function (p) { return 'Year ' + p.year; });
    var traditionalData = projection.map(function (p) { return p.cumulativeTraditional; });
    var automatedData   = projection.map(function (p) { return p.cumulativeAutomated; });

    // Build annotation config for the payback line
    var annotations = {};
    if (paybackYear != null && isFinite(paybackYear)) {
      // paybackYear is 1-based (e.g. 1.8 means partway through Year 2).
      // Chart x-axis indices are 0-based (0 = Year 1), so offset by 1.
      var xPosition = paybackYear - 1;
      annotations.paybackLine = {
        type: 'line',
        scaleID: 'x',
        xMin: xPosition,
        xMax: xPosition,
        borderColor: COLOR.orange,
        borderWidth: 2,
        borderDash: [6, 4],
        label: {
          display: true,
          content: 'Payback: ' + paybackYear.toFixed(1) + ' yrs',
          position: 'start',
          backgroundColor: COLOR.orange,
          color: COLOR.white,
          font: {
            family: FONT_FAMILY,
            size: 12,
            weight: '600'
          },
          padding: { top: 4, bottom: 4, left: 8, right: 8 },
          borderRadius: 4
        }
      };
    }

    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Traditional Mowing',
            data: traditionalData,
            borderColor: COLOR.black,
            backgroundColor: COLOR.black,
            pointBackgroundColor: COLOR.black,
            pointBorderColor: COLOR.white,
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            borderWidth: 3,
            fill: false
          },
          {
            label: 'Automated Mowing',
            data: automatedData,
            borderColor: COLOR.orange,
            backgroundColor: 'rgba(227, 118, 39, 0.08)',
            pointBackgroundColor: COLOR.orange,
            pointBorderColor: COLOR.white,
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            borderWidth: 3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: FONT_FAMILY, size: 12 },
              padding: 14,
              usePointStyle: true,
              pointStyleWidth: 12
            }
          },
          tooltip: {
            titleFont: { family: FONT_FAMILY },
            bodyFont: { family: FONT_FAMILY },
            callbacks: {
              label: function (context) {
                var label = context.dataset.label || '';
                var value = context.parsed.y || 0;
                return label + ': ' + formatCurrency(value);
              }
            }
          },
          annotation: {
            annotations: annotations
          }
        },
        scales: {
          x: {
            ticks: {
              font: { family: FONT_FAMILY, size: 12 }
            },
            grid: {
              color: 'rgba(0,0,0,0.04)'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { family: FONT_FAMILY, size: 11 },
              callback: function (value) {
                return formatCurrency(value);
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.06)'
            }
          }
        }
      }
    });

    _instances.push(chart);
    return chart;
  }

  // ---------------------------------------------------------------------------
  // Destroy all tracked chart instances
  // ---------------------------------------------------------------------------
  function destroyAll() {
    _instances.forEach(function (inst) {
      if (inst && typeof inst.destroy === 'function') {
        inst.destroy();
      }
    });
    _instances = [];
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.Charts = {
    renderDonut: renderDonut,
    renderComparison: renderComparison,
    renderProjection: renderProjection,
    destroyAll: destroyAll
  };

})();
