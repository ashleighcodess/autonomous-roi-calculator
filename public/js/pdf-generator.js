/**
 * PDF Report Generator
 * Autonomous Mowing Solutions ROI Calculator
 *
 * Generates a branded, multi-page PDF report using html2pdf.js (lazy-loaded
 * from CDN).  All layout uses HTML tables with inline styles so that the
 * html2canvas / jsPDF pipeline renders reliably.
 *
 * Usage:
 *   PDFGenerator.generate(results, equipment, projection, inputs);
 *
 * Depends on:
 *   - Calculator  (calculator.js)   -- for data shapes
 *   - Equipment   (equipment.js)    -- for data shapes
 *   - A hidden    #pdf-export       div in the DOM
 *   - A button    #download-pdf-btn in the DOM
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  var ORANGE   = '#E37627';
  var DARK     = '#1a1a2e';
  var LIGHT_BG = '#f9f9f9';

  var FOOTER_HTML =
    '<div style="margin-top:24px;padding-top:12px;border-top:2px solid ' + ORANGE + ';' +
    'font-size:10px;color:#666;text-align:center;font-family:Arial,sans-serif;">' +
      'Autonomous Mowing Solutions &nbsp;|&nbsp; autonomousmowingsolutions.com &nbsp;|&nbsp; (833) 554-2696' +
      '<br>This analysis is an estimate. Actual results may vary based on property conditions and usage.' +
    '</div>';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Format a number as whole-dollar US currency: $12,345 */
  function fmt(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  /** Format with two decimals: $5,829.99 */
  function fmtCents(n) {
    return '$' + Number(n).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }

  /** Readable property type label */
  function propertyLabel(type) {
    var labels = {
      commercial: 'Commercial Property',
      golf: 'Golf Course',
      athletic: 'Athletic Fields'
    };
    return labels[type] || 'Commercial Property';
  }

  /** Page-break div */
  function pageBreak() {
    return '<div class="pdf-page-break" style="page-break-before:always;"></div>';
  }

  /** Standard page wrapper open */
  function pageOpen() {
    return '<div style="font-family:Arial,sans-serif;color:#222;padding:0;">';
  }

  /** Standard page wrapper close (includes footer) */
  function pageClose() {
    return FOOTER_HTML + '</div>';
  }

  /** Section heading */
  function heading(text) {
    return '<h2 style="font-family:Arial,sans-serif;font-size:22px;color:' + DARK +
      ';margin:0 0 16px 0;padding-bottom:8px;border-bottom:3px solid ' + ORANGE + ';">' +
      text + '</h2>';
  }

  /** Build a simple HTML table from an array of row arrays.
   *  First row is treated as the header row.
   *  options.boldLastRow  -- bold the final row (for totals)
   *  options.alignRight   -- array of column indices to right-align
   */
  function buildTable(rows, options) {
    options = options || {};
    var alignRight = options.alignRight || [];
    var boldLast   = !!options.boldLastRow;

    function isRight(colIdx) {
      for (var k = 0; k < alignRight.length; k++) {
        if (alignRight[k] === colIdx) return true;
      }
      return false;
    }

    var html = '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-family:Arial,sans-serif;font-size:13px;">';

    for (var r = 0; r < rows.length; r++) {
      var isHeader  = r === 0;
      var isLastRow = r === rows.length - 1;
      var bgColor   = isHeader ? ORANGE : (r % 2 === 0 ? '#ffffff' : LIGHT_BG);
      var textColor = isHeader ? '#ffffff' : '#222';
      var fontWeight = isHeader || (boldLast && isLastRow) ? 'bold' : 'normal';

      html += '<tr style="background:' + bgColor + ';">';
      for (var c = 0; c < rows[r].length; c++) {
        var tag   = isHeader ? 'th' : 'td';
        var align = isRight(c) ? 'right' : 'left';
        var border = isHeader ? 'none' : '1px solid #e0e0e0';
        var topBorder = (boldLast && isLastRow) ? '2px solid ' + DARK : border;

        html += '<' + tag + ' style="padding:10px 12px;text-align:' + align +
          ';color:' + textColor + ';font-weight:' + fontWeight +
          ';border-bottom:' + border + ';border-top:' + topBorder + ';">' +
          rows[r][c] + '</' + tag + '>';
      }
      html += '</tr>';
    }

    html += '</table>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Lazy-load html2pdf.js
  // ---------------------------------------------------------------------------

  function loadHtml2Pdf() {
    return new Promise(function (resolve, reject) {
      if (window.html2pdf) return resolve(window.html2pdf);
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = function () { resolve(window.html2pdf); };
      script.onerror = function () { reject(new Error('Failed to load html2pdf.js from CDN')); };
      document.head.appendChild(script);
    });
  }

  // ---------------------------------------------------------------------------
  // Page builders
  // ---------------------------------------------------------------------------

  /** Page 1 -- Cover */
  function buildCover(inputs) {
    var date = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    return pageOpen() +
      '<div style="text-align:center;padding-top:120px;">' +
        '<div style="font-size:14px;letter-spacing:4px;color:' + ORANGE +
          ';font-weight:bold;text-transform:uppercase;margin-bottom:8px;">Autonomous Mowing Solutions</div>' +
        '<div style="width:80px;height:4px;background:' + ORANGE + ';margin:0 auto 40px auto;"></div>' +
        '<h1 style="font-family:Arial,sans-serif;font-size:36px;color:' + DARK +
          ';margin:0 0 16px 0;">ROI Analysis Report</h1>' +
        '<p style="font-size:18px;color:#555;margin:0 0 8px 0;">Prepared for ' +
          propertyLabel(inputs.propertyType) + ' &mdash; ' + inputs.acreage + ' Acres</p>' +
        '<p style="font-size:14px;color:#888;margin:0 0 60px 0;">' + date + '</p>' +
        '<div style="width:120px;height:4px;background:' + ORANGE + ';margin:0 auto;"></div>' +
      '</div>' +
      pageClose();
  }

  /** Page 2 -- Executive Summary */
  function buildExecutiveSummary(results, investmentMetrics) {
    var env = results.environmental;

    // 2x3 metric cards via a table
    var metricsTable =
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">' +
        metricRow([
          { label: 'Projected Annual Savings', value: fmt(results.netAnnualSavings) },
          { label: 'Payback Period', value: investmentMetrics.paybackYears === Infinity ? 'N/A' : investmentMetrics.paybackYears.toFixed(1) + ' years' },
          { label: 'Return on Investment', value: investmentMetrics.roi === Infinity ? 'N/A' : investmentMetrics.roi.toFixed(0) + '%' }
        ]) +
        metricRow([
          { label: 'Labor Hours Saved', value: results.labor.hoursSaved.toLocaleString('en-US') + ' hrs/year' },
          { label: 'CO\u2082 Reduction', value: Math.round(env.co2Reduced).toLocaleString('en-US') + ' lbs/year' },
          { label: 'Tree Equivalents', value: Math.round(env.treeEquivalents) + ' trees' }
        ]) +
      '</table>';

    return pageOpen() +
      heading('Executive Summary') +
      '<p style="font-size:14px;color:#555;margin-bottom:24px;font-family:Arial,sans-serif;">' +
        'Based on your property details, transitioning to autonomous mowing is projected to deliver ' +
        'significant cost savings and operational improvements.' +
      '</p>' +
      metricsTable +
      pageClose();
  }

  /** Helper: builds one row of 3 metric cards */
  function metricRow(items) {
    var html = '<tr>';
    for (var i = 0; i < items.length; i++) {
      html +=
        '<td style="width:33.33%;padding:8px;vertical-align:top;">' +
          '<div style="border:1px solid #e0e0e0;border-radius:8px;padding:20px;text-align:center;background:#fff;">' +
            '<div style="font-size:28px;font-weight:bold;color:' + ORANGE + ';font-family:Arial,sans-serif;margin-bottom:6px;">' +
              items[i].value +
            '</div>' +
            '<div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">' +
              items[i].label +
            '</div>' +
          '</div>' +
        '</td>';
    }
    html += '</tr>';
    return html;
  }

  /** Page 3 -- Equipment Recommendation */
  function buildEquipmentPage(equipment) {
    // Investment breakdown
    var breakdownRows = [['Item', 'Cost']];
    for (var b = 0; b < equipment.breakdown.length; b++) {
      breakdownRows.push([equipment.breakdown[b].label, fmtCents(equipment.breakdown[b].amount)]);
    }
    breakdownRows.push(['Total Investment', fmtCents(equipment.costs.totalInvestment)]);

    // Annual service breakdown
    var serviceRows = [['Service', 'Annual Cost']];
    for (var s = 0; s < equipment.annualBreakdown.length; s++) {
      serviceRows.push([equipment.annualBreakdown[s].label, fmtCents(equipment.annualBreakdown[s].amount)]);
    }
    serviceRows.push(['Total Annual Service', fmtCents(equipment.costs.annualService)]);

    return pageOpen() +
      heading('Equipment Recommendation') +
      '<div style="background:#f5f5f5;border-left:4px solid ' + ORANGE +
        ';padding:16px 20px;margin-bottom:20px;border-radius:0 8px 8px 0;font-family:Arial,sans-serif;">' +
        '<div style="font-size:18px;font-weight:bold;color:' + DARK + ';margin-bottom:4px;">' +
          equipment.model.name +
        '</div>' +
        '<div style="font-size:14px;color:#555;">' +
          'Quantity: ' + equipment.unitsNeeded + ' unit' + (equipment.unitsNeeded > 1 ? 's' : '') +
          ' &nbsp;&bull;&nbsp; Coverage: ' + equipment.model.coverage + ' acres each' +
          ' &nbsp;&bull;&nbsp; Target: ' + equipment.targetAcreage.toFixed(1) + ' acres' +
        '</div>' +
        '<div style="font-size:13px;color:#777;margin-top:6px;">' +
          equipment.model.description +
        '</div>' +
      '</div>' +
      '<h3 style="font-family:Arial,sans-serif;font-size:16px;color:' + DARK + ';margin:24px 0 8px 0;">Investment Breakdown</h3>' +
      buildTable(breakdownRows, { alignRight: [1], boldLastRow: true }) +
      '<h3 style="font-family:Arial,sans-serif;font-size:16px;color:' + DARK + ';margin:24px 0 8px 0;">Annual Service Costs</h3>' +
      buildTable(serviceRows, { alignRight: [1], boldLastRow: true }) +
      pageClose();
  }

  /** Page 4 -- Cost Analysis */
  function buildCostAnalysis(results) {
    var cur = results.currentCosts;
    var sav = results.savings;
    var nc  = results.newCosts;

    // Automated costs per category
    var automatedLabor     = cur.labor - sav.labor;
    var automatedFuel      = cur.fuel - sav.fuel;
    var automatedEquipment = cur.equipment - sav.equipment;
    var totalAutomated     = automatedLabor + automatedFuel + automatedEquipment + nc.maintenance + nc.electricity;
    var totalSavings       = cur.total - totalAutomated;

    var rows = [
      ['Category', 'Current Cost', 'Automated Cost', 'Savings'],
      ['Labor',                      fmt(cur.labor),      fmt(automatedLabor),     fmt(sav.labor)],
      ['Fuel',                       fmt(cur.fuel),       fmt(automatedFuel),      fmt(sav.fuel)],
      ['Equipment Maintenance',      fmt(cur.equipment),  fmt(automatedEquipment), fmt(sav.equipment)],
      ['Robotic Maintenance',        '\u2014',            fmt(nc.maintenance),     '\u2014'],
      ['Electricity',                '\u2014',            fmt(nc.electricity),     '\u2014'],
      ['Total',                      fmt(cur.total),      fmt(totalAutomated),     fmt(totalSavings)]
    ];

    return pageOpen() +
      heading('Cost Analysis') +
      '<p style="font-size:14px;color:#555;margin-bottom:16px;font-family:Arial,sans-serif;">' +
        'Side-by-side comparison of your current annual mowing costs versus projected costs with autonomous mowing.' +
      '</p>' +
      buildTable(rows, { alignRight: [1, 2, 3], boldLastRow: true }) +
      '<div style="background:#eaf7ea;border-radius:8px;padding:16px 20px;margin-top:8px;font-family:Arial,sans-serif;">' +
        '<span style="font-size:14px;color:#2d7a2d;font-weight:bold;">Net Annual Savings: ' +
          fmt(results.netAnnualSavings) +
        '</span>' +
        '<span style="font-size:12px;color:#555;margin-left:12px;">(after robotic maintenance &amp; electricity)</span>' +
      '</div>' +
      pageClose();
  }

  /** Page 5 -- 5-Year Projection */
  function buildProjection(projection) {
    var rows = [['Year', 'Traditional Cost', 'Automated Cost', 'Annual Savings', 'Cumulative Savings']];

    for (var y = 0; y < projection.length; y++) {
      var p = projection[y];
      rows.push([
        'Year ' + p.year,
        fmt(p.traditionalCost),
        fmt(p.automatedCost),
        fmt(p.annualSavings),
        fmt(p.cumulativeSavings)
      ]);
    }

    // Summary row: totals
    var totalTraditional = 0;
    var totalAutomated   = 0;
    var totalAnnualSav   = 0;
    for (var j = 0; j < projection.length; j++) {
      totalTraditional += projection[j].traditionalCost;
      totalAutomated   += projection[j].automatedCost;
      totalAnnualSav   += projection[j].annualSavings;
    }
    rows.push([
      '5-Year Total',
      fmt(totalTraditional),
      fmt(totalAutomated),
      fmt(totalAnnualSav),
      fmt(projection[projection.length - 1].cumulativeSavings)
    ]);

    return pageOpen() +
      heading('5-Year Projection') +
      '<p style="font-size:14px;color:#555;margin-bottom:16px;font-family:Arial,sans-serif;">' +
        'Year-over-year cost comparison accounting for annual labor and fuel cost increases.' +
      '</p>' +
      buildTable(rows, { alignRight: [1, 2, 3, 4], boldLastRow: true }) +
      pageClose();
  }

  /** Page 6 -- Environmental Impact */
  function buildEnvironmental(results) {
    var env = results.environmental;
    var rows = [
      ['Metric', 'Value'],
      ['CO\u2082 Emissions Reduced',          Math.round(env.co2Reduced).toLocaleString('en-US') + ' lbs/year'],
      ['Fuel Gallons Saved',                   Math.round(env.fuelGallonsSaved).toLocaleString('en-US') + ' gallons/year'],
      ['Noise Reduction',                      env.noiseReduction + ' dB (autonomous mowers are significantly quieter)'],
      ['Tree Equivalents',                     Math.round(env.treeEquivalents) + ' trees absorbing CO\u2082 annually']
    ];

    return pageOpen() +
      heading('Environmental Impact') +
      '<p style="font-size:14px;color:#555;margin-bottom:16px;font-family:Arial,sans-serif;">' +
        'Autonomous electric mowers eliminate gas engine emissions and operate at a fraction of the noise level, ' +
        'benefiting both the environment and the people near the mowing areas.' +
      '</p>' +
      buildTable(rows, { alignRight: [1] }) +
      '<div style="background:#f0f7ec;border-radius:8px;padding:16px 20px;margin-top:8px;font-family:Arial,sans-serif;font-size:13px;color:#3a6a2a;">' +
        'Equivalent to taking a car off the road for ' +
        Math.round(env.co2Reduced / 10180 * 12).toLocaleString('en-US') +
        ' months or planting ' + Math.round(env.treeEquivalents) + ' new trees.' +
      '</div>' +
      pageClose();
  }

  /** Page 7 -- Property Details & Methodology */
  function buildMethodology(inputs) {
    var maintenanceLabel = inputs.maintenanceType === 'outsourced' ? 'Outsourced' : 'In-House';

    var detailRows = [
      ['Detail', 'Value'],
      ['Property Type',         propertyLabel(inputs.propertyType)],
      ['Total Acreage',         inputs.acreage + ' acres'],
      ['Mowing Season',         inputs.seasonWeeks + ' weeks/year'],
      ['Mows Per Week',         inputs.mowsPerWeek + 'x'],
      ['Maintenance Type',      maintenanceLabel],
      ['Automation Level',      inputs.automationLevel + '%']
    ];

    if (inputs.maintenanceType === 'outsourced') {
      detailRows.push(['Monthly Contract', fmt(inputs.monthlyContract)]);
    } else {
      detailRows.push(['Employees',       inputs.employees.toString()]);
      detailRows.push(['Hourly Rate',     fmt(inputs.hourlyRate)]);
      detailRows.push(['Mowing Time %',   inputs.mowingTimePercent + '%']);
    }

    var assumptionRows = [
      ['Assumption', 'Value'],
      ['Annual Labor Cost Increase',  inputs.annualLaborIncrease + '%'],
      ['Annual Fuel Cost Increase',   inputs.annualFuelIncrease + '%'],
      ['Labor Reduction (automation)', inputs.laborReduction + '%'],
      ['Fuel Cost Per Gallon',        fmtCents(inputs.fuelCostPerGallon)],
      ['CO\u2082 Per Gallon of Fuel', inputs.co2PerGallon + ' lbs'],
      ['Benefits Rate',               inputs.benefitsRate + '%']
    ];

    return pageOpen() +
      heading('Property Details & Methodology') +
      '<h3 style="font-family:Arial,sans-serif;font-size:16px;color:' + DARK + ';margin:0 0 8px 0;">Property Inputs</h3>' +
      buildTable(detailRows, { alignRight: [1] }) +
      '<h3 style="font-family:Arial,sans-serif;font-size:16px;color:' + DARK + ';margin:24px 0 8px 0;">Key Assumptions</h3>' +
      buildTable(assumptionRows, { alignRight: [1] }) +
      '<div style="background:#f9f9f9;border-radius:8px;padding:16px 20px;margin-top:16px;font-family:Arial,sans-serif;font-size:12px;color:#666;">' +
        '<strong>Methodology Notes</strong><br>' +
        'Labor savings are calculated based on the automation level and the expected labor reduction percentage. ' +
        'Fuel savings assume full displacement of gas-powered mowing for the automated acreage. ' +
        'Equipment savings reflect reduced wear and maintenance on traditional mowers. ' +
        'New costs include robotic mower maintenance subscriptions and electricity for charging. ' +
        'Projection years apply compounding annual increases for labor and fuel costs. ' +
        'Environmental calculations use EPA standard emission factors for gasoline-powered equipment.' +
      '</div>' +
      pageClose();
  }

  // ---------------------------------------------------------------------------
  // Main generate function
  // ---------------------------------------------------------------------------

  /**
   * Generate and download a branded PDF report.
   *
   * @param {Object} results    - Output from Calculator.calculateROI()
   * @param {Object} equipment  - Output from Equipment.recommend()
   * @param {Array}  projection - Output from Calculator.calculateProjection()
   * @param {Object} inputs     - The resolved user inputs
   * @returns {Promise<void>}
   */
  async function generate(results, equipment, projection, inputs) {
    var btn = document.getElementById('download-pdf-btn');
    var container = document.getElementById('pdf-export');
    var originalBtnHTML = btn ? btn.innerHTML : '';

    try {
      // -- 1. Show loading state --
      if (btn) {
        btn.disabled = true;
        btn.innerHTML =
          '<svg style="animation:spin 1s linear infinite;margin-right:8px;" width="18" height="18" viewBox="0 0 18 18" fill="none">' +
            '<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2" stroke-dasharray="30 14" stroke-linecap="round"/>' +
          '</svg>' +
          'Generating PDF\u2026';

        // Add spin animation if not already present
        if (!document.getElementById('pdf-spin-style')) {
          var style = document.createElement('style');
          style.id = 'pdf-spin-style';
          style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
          document.head.appendChild(style);
        }
      }

      // -- 2. Lazy-load html2pdf.js --
      var html2pdf = await loadHtml2Pdf();

      // -- 3. Compute investment metrics --
      var investmentMetrics = results.withInvestment(
        equipment.costs.totalInvestment,
        equipment.costs.annualService
      );

      // -- 4. Build the full HTML document --
      var html =
        buildCover(inputs) +
        pageBreak() +
        buildExecutiveSummary(results, investmentMetrics) +
        pageBreak() +
        buildEquipmentPage(equipment) +
        pageBreak() +
        buildCostAnalysis(results) +
        pageBreak() +
        buildProjection(projection) +
        pageBreak() +
        buildEnvironmental(results) +
        pageBreak() +
        buildMethodology(inputs);

      // -- 5. Render in an iframe to isolate from page CSS --
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:816px;height:1056px;opacity:0;z-index:-1;border:none;';
      document.body.appendChild(iframe);

      var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(
        '<!DOCTYPE html><html><head><style>' +
        'body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#222;width:7.5in;}' +
        'table{border-collapse:collapse;}' +
        '.pdf-page-break{page-break-before:always;}' +
        '</style></head><body>' + html + '</body></html>'
      );
      iframeDoc.close();

      // Wait for iframe content to render
      await new Promise(function (r) { setTimeout(r, 1000); });

      var iframeBody = iframeDoc.body;
      console.log('[PDFGenerator] iframe body dimensions:', iframeBody.scrollWidth, 'x', iframeBody.scrollHeight);

      // -- 6. Generate and save the PDF from the iframe body --
      var filename = 'AMS-ROI-Report-' + new Date().toISOString().split('T')[0] + '.pdf';

      await html2pdf()
        .set({
          margin:    [0.5, 0.75, 0.75, 0.75],
          filename:  filename,
          image:     { type: 'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: 816,
            logging: true
          },
          jsPDF:     { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.pdf-page-break' }
        })
        .from(iframeBody)
        .save();

      // Remove iframe
      document.body.removeChild(iframe);

    } catch (err) {
      console.error('[PDFGenerator] Error generating PDF:', err);
      if (typeof window.alert === 'function') {
        window.alert('There was a problem generating the PDF. Please try again.');
      }
    } finally {
      // -- 7. Clean up --
      // Clean up iframe if still present (e.g. on error)
      var leftover = document.querySelector('iframe[style*="z-index:-1"]');
      if (leftover) document.body.removeChild(leftover);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHTML;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.PDFGenerator = {
    generate: generate
  };

})();
