/**
 * App Controller — Wizard navigation, state management, and results rendering
 * Autonomous Mowing Solutions ROI Calculator
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var currentStep = 1;
  var maxCompletedStep = 0;
  var calculationResults = null;
  var equipmentRecommendation = null;
  var investmentMetrics = null;
  var projectionData = null;

  // ---------------------------------------------------------------------------
  // DOM references (cached after DOMContentLoaded)
  // ---------------------------------------------------------------------------
  var $steps, $progressSteps, $progressBar, $wizard, $resultsSection;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function $(selector, parent) {
    return (parent || document).querySelector(selector);
  }
  function $$(selector, parent) {
    return Array.prototype.slice.call((parent || document).querySelectorAll(selector));
  }
  function fmt(n) {
    if (n == null || isNaN(n)) return '--';
    return '$' + Math.round(Number(n)).toLocaleString('en-US');
  }
  function fmtDecimal(n) {
    if (n == null || isNaN(n)) return '--';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '--';
    return Math.round(Number(n)).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n == null || isNaN(n)) return '--';
    return Math.round(Number(n)) + '%';
  }

  // ---------------------------------------------------------------------------
  // Wizard Navigation
  // ---------------------------------------------------------------------------
  function goToStep(step) {
    if (step < 1 || step > 4) return;
    if (step > maxCompletedStep + 1 && step > currentStep + 1) return;

    // Validate current step before advancing
    if (step > currentStep && !validateStep(currentStep)) return;

    // Mark current step as completed if going forward
    if (step > currentStep) {
      maxCompletedStep = Math.max(maxCompletedStep, currentStep);
    }

    currentStep = step;

    // Toggle wizard step visibility
    $steps.forEach(function (el) {
      var stepNum = parseInt(el.getAttribute('data-step'), 10);
      if (stepNum === step) {
        el.classList.add('active');
        el.removeAttribute('hidden');
      } else {
        el.classList.remove('active');
        el.setAttribute('hidden', '');
      }
    });

    // Update progress bar
    $progressSteps.forEach(function (el) {
      var stepNum = parseInt(el.getAttribute('data-step'), 10);
      var btn = $('button', el);
      el.classList.remove('active', 'completed');
      if (stepNum === step) {
        el.classList.add('active');
        if (btn) btn.setAttribute('aria-current', 'step');
      } else {
        if (btn) btn.removeAttribute('aria-current');
      }
      if (stepNum < step || stepNum <= maxCompletedStep) {
        el.classList.add('completed');
        if (btn) btn.removeAttribute('disabled');
      } else if (stepNum > maxCompletedStep + 1) {
        if (btn) btn.setAttribute('disabled', '');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update property-type-dependent defaults when entering step 2
    if (step === 2) {
      updatePropertyDefaults();
    }
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  function validateStep(step) {
    var valid = true;
    clearErrors();

    if (step === 1) {
      var propType = $('#property-type').value;
      var acreage = $('#total-acreage').value;
      if (!propType) { showError('#property-type', 'Please select a property type'); valid = false; }
      if (!acreage || Number(acreage) <= 0) { showError('#total-acreage', 'Please enter your mowable acreage'); valid = false; }
    }

    if (step === 2) {
      var mType = $('#maintenance-type').value;
      if (mType === 'in-house') {
        var emp = $('#employee-count').value;
        var rate = $('#hourly-rate').value;
        if (!emp || Number(emp) < 1) { showError('#employee-count', 'Please enter number of employees'); valid = false; }
        if (!rate || Number(rate) < 10) { showError('#hourly-rate', 'Please enter an hourly rate ($10+)'); valid = false; }
      } else {
        var contract = $('#contract-cost').value;
        if (!contract || Number(contract) <= 0) { showError('#contract-cost', 'Please enter monthly contract cost'); valid = false; }
      }
    }

    return valid;
  }

  function showError(selector, message) {
    var input = $(selector);
    if (!input) return;
    input.classList.add('error');
    var group = input.closest('.form-group');
    if (group) {
      var existing = $('.error-message', group);
      if (!existing) {
        var err = document.createElement('span');
        err.className = 'error-message';
        err.setAttribute('role', 'alert');
        err.textContent = message;
        group.appendChild(err);
      }
    }
  }

  function clearErrors() {
    $$('.form-input.error, .form-select.error').forEach(function (el) {
      el.classList.remove('error');
    });
    $$('.error-message').forEach(function (el) {
      el.remove();
    });
  }

  // ---------------------------------------------------------------------------
  // Gather inputs from the form
  // ---------------------------------------------------------------------------
  function gatherInputs() {
    var propType = $('#property-type').value;
    var defaults = Calculator.PROPERTY_DEFAULTS[propType] || Calculator.PROPERTY_DEFAULTS.commercial;

    return {
      propertyType: propType,
      acreage: parseFloat($('#total-acreage').value) || 0,
      seasonWeeks: parseInt($('#season-length').value, 10) || 30,

      maintenanceType: $('#maintenance-type').value === 'outsourced' ? 'outsourced' : 'inhouse',

      employees: parseInt($('#employee-count').value, 10) || 0,
      hourlyRate: parseFloat($('#hourly-rate').value) || 0,
      mowingTimePercent: parseInt($('#mowing-time-pct').value, 10) || 60,
      isLeased: $('#equipment-leased').checked,

      monthlyContract: parseFloat($('#contract-cost').value) || 0,

      // Basic assumptions
      benefitsRate: parseInt($('#benefits-pct').value, 10),
      fuelCostPerGallon: parseFloat($('#fuel-cost').value),
      laborReduction: parseInt($('#labor-reduction').value, 10),
      bufferTime: parseInt($('#buffer-time').value, 10),

      // Advanced assumptions
      annualLaborIncrease: parseFloat($('#labor-cost-increase').value),
      fuelPerAcre: parseFloat($('#fuel-consumption').value),
      annualFuelIncrease: parseFloat($('#fuel-cost-increase').value),
      baseEquipmentCost: parseFloat($('#base-equipment-cost').value),
      equipmentCostPerAcre: parseFloat($('#equipment-cost-per-acre').value),
      maintenanceRate: parseInt($('#annual-maintenance-pct').value, 10),
      insuranceRate: parseInt($('#equipment-insurance-pct').value, 10),
      leasingPremium: parseInt($('#leasing-premium-pct').value, 10),
      roboticMaintenance: parseFloat($('#robotic-maintenance').value),
      electricityPerAcre: parseFloat($('#electricity-per-acre').value),
      co2PerGallon: parseFloat($('#co2-per-gallon').value),
      mowingTimePerAcre: parseInt($('#mowing-time-per-acre').value, 10),

      // Goals
      automationLevel: parseInt($('#automation-level').value, 10),
      desiredMowingTime: parseInt($('#desired-mowing-time').value, 10)
    };
  }

  // ---------------------------------------------------------------------------
  // Update property-type-dependent defaults
  // ---------------------------------------------------------------------------
  function updatePropertyDefaults() {
    var propType = $('#property-type').value;
    if (!propType) return;
    var defaults = Calculator.PROPERTY_DEFAULTS[propType];
    if (!defaults) return;

    // Update fuel consumption and mowing time fields with property defaults
    var fuelInput = $('#fuel-consumption');
    var mowingInput = $('#mowing-time-per-acre');
    if (fuelInput && fuelInput.value === fuelInput.defaultValue) {
      fuelInput.value = defaults.fuelPerAcre;
    }
    if (mowingInput && mowingInput.value === mowingInput.defaultValue) {
      mowingInput.value = defaults.mowingTimePerAcre;
    }
  }

  // ---------------------------------------------------------------------------
  // Calculate & Render Results
  // ---------------------------------------------------------------------------
  function runCalculation() {
    var inputs = gatherInputs();

    // Run calculation engine
    calculationResults = Calculator.calculateROI(inputs);

    // Get equipment recommendation
    var isHilly = inputs.propertyType === 'golf'; // golf defaults to hilly
    equipmentRecommendation = Equipment.recommend(
      inputs.propertyType,
      inputs.acreage,
      inputs.automationLevel,
      isHilly
    );

    // Complete ROI with investment data
    investmentMetrics = calculationResults.withInvestment(
      equipmentRecommendation.costs.totalInvestment,
      equipmentRecommendation.costs.annualService
    );

    // 5-year projection
    projectionData = Calculator.calculateProjection(
      calculationResults,
      equipmentRecommendation.costs.totalInvestment,
      equipmentRecommendation.costs.annualService
    );

    // Render all results sections
    renderHeroMetrics();
    renderEquipmentRecommendation();
    renderInvestmentSummary();
    renderCostAnalysis();
    renderProjection();
    renderLaborAnalysis();
    renderEnvironmentalImpact();
    renderMethodology();
    renderPropertyDetails();
    setLeadCaptureData();

    // Render charts
    if (typeof Charts !== 'undefined') {
      Charts.destroyAll();
      Charts.renderDonut('chart-donut', calculationResults.currentCosts);
      Charts.renderComparison('chart-bar',
        {
          labor: calculationResults.currentCosts.labor,
          fuel: calculationResults.currentCosts.fuel,
          equipment: calculationResults.currentCosts.equipment,
          maintenance: 0,
          electricity: 0
        },
        {
          labor: calculationResults.currentCosts.labor - calculationResults.savings.labor,
          fuel: calculationResults.currentCosts.fuel - calculationResults.savings.fuel,
          equipment: calculationResults.currentCosts.equipment - calculationResults.savings.equipment,
          maintenance: calculationResults.newCosts.maintenance,
          electricity: calculationResults.newCosts.electricity
        }
      );
      Charts.renderProjection('chart-line', projectionData, investmentMetrics.paybackYears);
    }

    // Show results, update progress
    maxCompletedStep = 3;
    goToStep(4);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderHeroMetrics() {
    var r = calculationResults;
    var m = investmentMetrics;
    setMetric('savings', fmt(r.netAnnualSavings));
    setMetric('payback', m.paybackYears === Infinity ? 'N/A' : m.paybackYears.toFixed(1) + ' years');
    setMetric('roi', m.roi === Infinity ? 'N/A' : Math.round(m.roi) + '%');
    setMetric('hours', fmtNum(r.labor.hoursSaved) + ' hrs/yr');
    setMetric('co2', fmtNum(r.environmental.co2Reduced) + ' lbs/yr');
  }

  function setMetric(key, value) {
    var el = $('[data-metric="' + key + '"]');
    if (el) el.textContent = value;
  }

  function renderEquipmentRecommendation() {
    var eq = equipmentRecommendation;
    $('#equipment-model-name').textContent = eq.model.name;
    $('#equipment-units-needed').innerHTML = 'Units needed: <strong>' + eq.unitsNeeded + '</strong> (' + eq.targetAcreage.toFixed(1) + ' acres automated)';

    // Set product image
    var imgEl = $('#equipment-product-img');
    if (imgEl) {
      var imageMap = {
        '520 EPOS': 'images/products/automower-520-epos.png',
        '520H EPOS': 'images/products/automower-520h-epos.png',
        '535 AWD EPOS': 'images/products/automower-535-awd-epos.png',
        '550 EPOS': 'images/products/automower-550-epos.png',
        '550H EPOS': 'images/products/automower-550h-epos.png'
      };
      var src = imageMap[eq.model.shortName];
      if (src) {
        imgEl.src = src;
        imgEl.alt = eq.model.name;
        imgEl.style.display = 'block';
        var placeholder = $('#equipment-image-placeholder');
        if (placeholder) placeholder.style.display = 'none';
      }
    }

    // Build pricing table
    var tbody = $('#equipment-pricing-body');
    tbody.innerHTML = '';
    eq.breakdown.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + item.label + '</td><td>' + fmtDecimal(item.amount) + '</td>';
      tbody.appendChild(tr);
    });

    // Set total equipment investment
    setField('total-equipment', '<strong>' + fmt(eq.costs.totalInvestment) + '</strong>');
  }

  function renderInvestmentSummary() {
    var eq = equipmentRecommendation;
    setField('invest-equipment', fmtDecimal(eq.costs.totalEquipment));
    setField('invest-installation', fmtDecimal(eq.costs.installation));
    setField('invest-setup', fmtDecimal(eq.costs.setup));
    setField('invest-service', fmtDecimal(eq.costs.annualService) + '/yr');
    setField('invest-first-year', '<strong>' + fmt(eq.costs.totalInvestment + eq.costs.annualService) + '</strong>');
    setField('invest-ongoing', '<strong>' + fmt(eq.costs.annualService + calculationResults.newCosts.total) + '/yr</strong>');
  }

  function renderCostAnalysis() {
    var r = calculationResults;
    var autoLabor = r.currentCosts.labor - r.savings.labor;
    var autoFuel = r.currentCosts.fuel - r.savings.fuel;
    var autoEquip = r.currentCosts.equipment - r.savings.equipment;

    setField('cost-labor-current', fmt(r.currentCosts.labor));
    setField('cost-labor-auto', fmt(autoLabor));
    setField('cost-labor-savings', fmt(r.savings.labor));

    setField('cost-fuel-current', fmt(r.currentCosts.fuel));
    setField('cost-fuel-auto', fmt(autoFuel));
    setField('cost-fuel-savings', fmt(r.savings.fuel));

    setField('cost-equip-current', fmt(r.currentCosts.equipment));
    setField('cost-equip-auto', fmt(autoEquip));
    setField('cost-equip-savings', fmt(r.savings.equipment));

    setField('cost-maint-current', fmt(0));
    setField('cost-maint-auto', fmt(r.newCosts.maintenance));
    setField('cost-maint-savings', '--');

    setField('cost-elec-current', fmt(0));
    setField('cost-elec-auto', fmt(r.newCosts.electricity));
    setField('cost-elec-savings', '--');

    var totalAuto = autoLabor + autoFuel + autoEquip + r.newCosts.maintenance + r.newCosts.electricity;
    setField('cost-total-current', '<strong>' + fmt(r.currentCosts.total) + '</strong>');
    setField('cost-total-auto', '<strong>' + fmt(totalAuto) + '</strong>');
    setField('cost-total-savings', '<strong>' + fmt(r.netAnnualSavings) + '</strong>');
  }

  function renderProjection() {
    var tbody = $('#projection-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    projectionData.forEach(function (yr) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>Year ' + yr.year + '</td>' +
        '<td>' + fmt(yr.traditionalCost) + '</td>' +
        '<td>' + fmt(yr.automatedCost) + '</td>' +
        '<td class="savings-cell">' + fmt(yr.annualSavings) + '</td>' +
        '<td class="savings-cell">' + fmt(yr.cumulativeSavings) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function renderLaborAnalysis() {
    var r = calculationResults;
    var inputs = r.inputs;
    var weeklyHoursCurrent = r.labor.currentHours / inputs.seasonWeeks;
    var weeklyHoursSaved = r.labor.hoursSaved / inputs.seasonWeeks;
    var weeklyHoursAuto = weeklyHoursCurrent - weeklyHoursSaved;

    $('#labor-hours-current').textContent = Math.round(weeklyHoursCurrent) + ' hrs';
    $('#labor-hours-auto').textContent = Math.round(weeklyHoursAuto) + ' hrs';
    $('#labor-hours-saved').textContent = Math.round(weeklyHoursSaved) + ' hrs';
    $('#labor-hours-annual').textContent = fmtNum(r.labor.hoursSaved) + ' hrs';

    // Staffing recommendation
    var text = '';
    if (r.inputs.maintenanceType === 'outsourced') {
      text = 'With ' + r.inputs.automationLevel + '% automation, you can significantly reduce your outsourced mowing contract. ' +
        'Remaining crew time will focus on supervision, edge trimming, and landscape detail work.';
    } else {
      if (r.labor.reducedFTE < 1) {
        text = 'Automation at ' + r.inputs.automationLevel + '% can handle nearly all mowing tasks. ' +
          'You may reassign mowing staff to other landscape and maintenance duties, ' +
          'with minimal supervision needed for the robotic fleet.';
      } else {
        text = 'With ' + r.inputs.automationLevel + '% automation, your mowing staff can be reduced from ' +
          r.labor.currentFTE + ' to approximately ' + r.labor.reducedFTE.toFixed(1) + ' FTE. ' +
          'Remaining staff time shifts to supervision, edge work, and other landscape tasks.';
      }
    }
    $('#staffing-text').textContent = text;
  }

  function renderEnvironmentalImpact() {
    var e = calculationResults.environmental;
    $('#env-co2-reduced').textContent = fmtNum(e.co2Reduced);
    $('#env-fuel-saved').textContent = fmtNum(e.fuelGallonsSaved);
    $('#env-tree-equivalents').textContent = fmtNum(e.treeEquivalents) + ' trees';
  }

  function renderMethodology() {
    var r = calculationResults;
    var i = r.inputs;

    // Labor methodology
    var laborEl = $('#methodology-labor');
    if (laborEl) {
      if (i.maintenanceType === 'outsourced') {
        laborEl.innerHTML =
          '<p><strong>Formula:</strong> Monthly Contract × 12</p>' +
          '<p><code>' + fmt(i.monthlyContract) + ' × 12 = ' + fmt(r.currentCosts.labor) + '</code></p>' +
          '<p><strong>Savings:</strong> Contract Cost × Automation Level × 85%</p>' +
          '<p><code>' + fmt(r.currentCosts.labor) + ' × ' + i.automationLevel + '% × 85% = ' + fmt(r.savings.labor) + '</code></p>';
      } else {
        laborEl.innerHTML =
          '<p><strong>Formula:</strong> Employees × Hourly Rate × (1 + Benefits%) × 40 hrs/wk × Season Weeks × Mowing Time% × (1 + Buffer%)</p>' +
          '<p><code>' + i.employees + ' × $' + i.hourlyRate + ' × ' + (1 + i.benefitsRate / 100).toFixed(2) +
          ' × 40 × ' + i.seasonWeeks + ' × ' + (i.mowingTimePercent / 100).toFixed(2) +
          ' × ' + (1 + i.bufferTime / 100).toFixed(2) + ' = ' + fmt(r.currentCosts.labor) + '</code></p>' +
          '<p><strong>Savings:</strong> Labor Cost × Automation Level × Labor Reduction Rate</p>' +
          '<p><code>' + fmt(r.currentCosts.labor) + ' × ' + i.automationLevel + '% × ' + i.laborReduction + '% = ' + fmt(r.savings.labor) + '</code></p>';
      }
    }

    // Fuel methodology
    var fuelEl = $('#methodology-fuel');
    if (fuelEl) {
      fuelEl.innerHTML =
        '<p><strong>Formula:</strong> Acreage × Fuel/Acre × Mows/Week × Season Weeks × Fuel Cost</p>' +
        '<p><code>' + i.acreage + ' × ' + i.fuelPerAcre + ' × ' + i.mowsPerWeek +
        ' × ' + i.seasonWeeks + ' × $' + i.fuelCostPerGallon + ' = ' + fmt(r.currentCosts.fuel) + '</code></p>' +
        '<p><strong>New Electricity Cost:</strong> Acreage × Automation% × kWh/acre × $0.12 × Mows/Week × Season Weeks</p>' +
        '<p><code>' + i.acreage + ' × ' + i.automationLevel + '% × ' + i.electricityPerAcre +
        ' × $0.12 × ' + i.mowsPerWeek + ' × ' + i.seasonWeeks + ' = ' + fmt(r.newCosts.electricity) + '</code></p>';
    }

    // Equipment methodology
    var equipEl = $('#methodology-equipment');
    if (equipEl) {
      equipEl.innerHTML =
        '<p><strong>Current Equipment Cost:</strong> (Base + Per-Acre × Acreage) × (Maintenance% + Insurance%)</p>' +
        '<p><code>($' + fmtNum(i.baseEquipmentCost) + ' + $' + fmtNum(i.equipmentCostPerAcre) + ' × ' + i.acreage +
        ') × (' + i.maintenanceRate + '% + ' + i.insuranceRate + '%)' +
        (i.isLeased ? ' × (1 + ' + i.leasingPremium + '% lease premium)' : '') +
        ' = ' + fmt(r.currentCosts.equipment) + '</code></p>';
    }

    // ROI methodology
    var roiEl = $('#methodology-roi');
    if (roiEl) {
      roiEl.innerHTML =
        '<p><strong>Net Annual Savings:</strong> Gross Savings − New Costs − Annual Service</p>' +
        '<p><code>' + fmt(r.savings.gross) + ' − ' + fmt(r.newCosts.total) + ' − ' + fmt(investmentMetrics.annualServiceCost) +
        ' = ' + fmt(r.netAnnualSavings - investmentMetrics.annualServiceCost) + '</code></p>' +
        '<p><strong>ROI:</strong> Net Savings ÷ Total Investment × 100</p>' +
        '<p><code>' + fmt(r.netAnnualSavings - investmentMetrics.annualServiceCost) + ' ÷ ' + fmt(investmentMetrics.totalInvestment) +
        ' × 100 = ' + Math.round(investmentMetrics.roi) + '%</code></p>' +
        '<p><strong>Payback:</strong> Total Investment ÷ Net Savings</p>' +
        '<p><code>' + fmt(investmentMetrics.totalInvestment) + ' ÷ ' + fmt(r.netAnnualSavings - investmentMetrics.annualServiceCost) +
        ' = ' + investmentMetrics.paybackYears.toFixed(1) + ' years</code></p>';
    }

    // Environmental methodology
    var envEl = $('#methodology-environmental');
    if (envEl) {
      envEl.innerHTML =
        '<p><strong>CO₂ Reduced:</strong> Acreage × Automation% × Fuel/Acre × CO₂/Gallon × Mows/Week × Season Weeks</p>' +
        '<p><code>' + i.acreage + ' × ' + i.automationLevel + '% × ' + i.fuelPerAcre +
        ' × ' + i.co2PerGallon + ' × ' + i.mowsPerWeek + ' × ' + i.seasonWeeks +
        ' = ' + fmtNum(r.environmental.co2Reduced) + ' lbs</code></p>' +
        '<p><strong>Tree Equivalents:</strong> CO₂ Reduced ÷ 48 lbs/tree/year (EPA)</p>' +
        '<p><code>' + fmtNum(r.environmental.co2Reduced) + ' ÷ 48 = ' + fmtNum(r.environmental.treeEquivalents) + ' trees</code></p>';
    }
  }

  function renderPropertyDetails() {
    var i = calculationResults.inputs;
    var tbody = $('#property-details-body');
    if (!tbody) return;

    var propertyTypeLabels = { commercial: 'Commercial Property', golf: 'Golf Course', athletic: 'Athletic Fields' };
    var rows = [
      ['Property Type', propertyTypeLabels[i.propertyType] || i.propertyType],
      ['Total Acreage', i.acreage + ' acres'],
      ['Season Length', i.seasonWeeks + ' weeks'],
      ['Mows per Week', i.mowsPerWeek],
      ['Maintenance Type', i.maintenanceType === 'outsourced' ? 'Outsourced' : 'In-House'],
    ];

    if (i.maintenanceType === 'inhouse') {
      rows.push(
        ['Employees', i.employees],
        ['Hourly Rate', '$' + i.hourlyRate.toFixed(2)],
        ['Mowing Time %', i.mowingTimePercent + '%'],
        ['Equipment Leased', i.isLeased ? 'Yes' : 'No']
      );
    } else {
      rows.push(['Monthly Contract', fmt(i.monthlyContract)]);
    }

    rows.push(
      ['Automation Level', i.automationLevel + '%'],
      ['Desired Mowing Time', i.desiredMowingTime + '%']
    );

    tbody.innerHTML = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="detail-label">' + row[0] + '</td><td class="detail-value">' + row[1] + '</td>';
      tbody.appendChild(tr);
    });
  }

  function setLeadCaptureData() {
    var r = calculationResults;
    var eq = equipmentRecommendation;
    var m = investmentMetrics;

    setHidden('lead-property-type', r.inputs.propertyType);
    setHidden('lead-acreage', r.inputs.acreage);
    setHidden('lead-annual-savings', Math.round(r.netAnnualSavings));
    setHidden('lead-payback-period', m.paybackYears.toFixed(1) + ' years');
    setHidden('lead-roi', Math.round(m.roi));
    setHidden('lead-equipment-model', eq.model.name + ' x ' + eq.unitsNeeded);

    // Set data for lead capture module
    if (typeof LeadCapture !== 'undefined') {
      LeadCapture.setCalculatorData({
        propertyType: r.inputs.propertyType,
        acreage: r.inputs.acreage,
        seasonWeeks: r.inputs.seasonWeeks,
        maintenanceType: r.inputs.maintenanceType,
        projectedSavings: Math.round(r.netAnnualSavings),
        roi: Math.round(m.roi),
        paybackPeriod: m.paybackYears.toFixed(1) + ' years',
        recommendedEquipment: eq.model.name + ' x ' + eq.unitsNeeded,
        totalInvestment: Math.round(eq.costs.totalInvestment),
        co2Reduced: Math.round(r.environmental.co2Reduced),
        laborHoursSaved: r.labor.hoursSaved
      });
    }
  }

  function setField(key, value) {
    var el = $('[data-field="' + key + '"]');
    if (el) el.innerHTML = value;
  }

  function setHidden(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value;
  }

  // ---------------------------------------------------------------------------
  // UI Interactions
  // ---------------------------------------------------------------------------

  function initCardSelector() {
    $$('.card-selector').forEach(function (selector) {
      var cards = $$('.card-option', selector);
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          cards.forEach(function (c) {
            c.classList.remove('selected');
            c.setAttribute('aria-checked', 'false');
          });
          card.classList.add('selected');
          card.setAttribute('aria-checked', 'true');

          var value = card.getAttribute('data-value');
          $('#maintenance-type').value = value;

          // Toggle field visibility
          var inhouseFields = $('#inhouse-fields');
          var outsourcedFields = $('#outsourced-fields');
          if (value === 'outsourced') {
            inhouseFields.classList.add('hidden');
            inhouseFields.setAttribute('hidden', '');
            outsourcedFields.classList.remove('hidden');
            outsourcedFields.removeAttribute('hidden');
          } else {
            inhouseFields.classList.remove('hidden');
            inhouseFields.removeAttribute('hidden');
            outsourcedFields.classList.add('hidden');
            outsourcedFields.setAttribute('hidden', '');
          }
        });
      });
    });
  }

  function initRangeSliders() {
    $$('input[type="range"]').forEach(function (slider) {
      var output = $('output[for="' + slider.id + '"]') || $('#' + slider.id + '-value');
      if (!output) return;

      function update() {
        var val = slider.value;
        // Determine if it's a percentage slider
        var isPercent = slider.id.indexOf('pct') >= 0 ||
          slider.id === 'benefits-pct' ||
          slider.id === 'labor-reduction' ||
          slider.id === 'buffer-time' ||
          slider.id === 'automation-level' ||
          slider.id === 'desired-mowing-time' ||
          slider.id === 'annual-maintenance-pct' ||
          slider.id === 'equipment-insurance-pct' ||
          slider.id === 'leasing-premium-pct' ||
          slider.id === 'labor-cost-increase' ||
          slider.id === 'fuel-cost-increase';
        output.textContent = val + (isPercent ? '%' : '');
        slider.setAttribute('aria-valuenow', val);

        // Update slider fill
        var min = parseFloat(slider.min) || 0;
        var max = parseFloat(slider.max) || 100;
        var pct = ((val - min) / (max - min)) * 100;
        slider.style.setProperty('--fill', pct + '%');
      }

      slider.addEventListener('input', update);
      update(); // Initialize
    });
  }

  function initAutomationInfo() {
    var slider = $('#automation-level');
    var infoBox = $('#automation-info');
    if (!slider || !infoBox) return;

    function updateInfo() {
      var level = parseInt(slider.value, 10);
      var text = '';
      if (level <= 30) {
        text = 'Minimal automation: ideal for testing the technology on a small section of your property before scaling up.';
      } else if (level <= 50) {
        text = 'Balanced approach: automate primary mowing areas while keeping manual crews for detail work and complex zones.';
      } else if (level <= 75) {
        text = 'Significant automation: most open areas handled robotically. Manual crews focus on edges, slopes, and special areas.';
      } else {
        text = 'Full automation: robotic mowers handle nearly all mowing. Minimal staff needed for supervision and occasional edge work.';
      }
      var p = $('p', infoBox);
      if (p) p.textContent = text;
    }

    slider.addEventListener('input', updateInfo);
  }

  function initAssumptionsToggle() {
    var toggle = $('.assumptions-toggle');
    var content = $('#assumptions-content');
    if (!toggle || !content) return;

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !expanded);
      if (expanded) {
        content.setAttribute('hidden', '');
      } else {
        content.removeAttribute('hidden');
      }
    });

    // Advanced toggle
    var advToggle = $('.advanced-toggle');
    var advContent = $('#advanced-assumptions');
    if (!advToggle || !advContent) return;

    advToggle.addEventListener('click', function () {
      var expanded = advToggle.getAttribute('aria-expanded') === 'true';
      advToggle.setAttribute('aria-expanded', !expanded);
      advToggle.textContent = expanded ? 'Show all assumptions' : 'Hide advanced assumptions';
      if (expanded) {
        advContent.setAttribute('hidden', '');
      } else {
        advContent.removeAttribute('hidden');
      }
    });
  }

  function initNavigation() {
    // Next buttons
    $$('.btn-next').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nextStep = parseInt(btn.getAttribute('data-next'), 10);
        goToStep(nextStep);
      });
    });

    // Back buttons
    $$('.btn-back').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var prevStep = parseInt(btn.getAttribute('data-prev'), 10);
        goToStep(prevStep);
      });
    });

    // Progress bar step clicks
    $$('.progress-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var step = parseInt(btn.closest('.progress-step').getAttribute('data-step'), 10);
        goToStep(step);
      });
    });

    // Calculate button
    var calcBtn = $('#calculate-btn');
    if (calcBtn) {
      calcBtn.addEventListener('click', function () {
        if (!validateStep(3)) return;
        runCalculation();
      });
    }

    // Start over button
    var startOverBtn = $('#start-over-btn');
    if (startOverBtn) {
      startOverBtn.addEventListener('click', function () {
        startOver();
      });
    }

    // Download PDF button
    var pdfBtn = $('#download-pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', function () {
        if (typeof PDFGenerator !== 'undefined' && calculationResults) {
          PDFGenerator.generate(
            calculationResults,
            equipmentRecommendation,
            projectionData,
            calculationResults.inputs
          );
        }
      });
    }
  }

  function startOver() {
    currentStep = 1;
    maxCompletedStep = 0;
    calculationResults = null;
    equipmentRecommendation = null;
    investmentMetrics = null;
    projectionData = null;

    if (typeof Charts !== 'undefined') Charts.destroyAll();

    // Reset form fields
    $$('input[type="number"], input[type="text"], input[type="email"], input[type="tel"]').forEach(function (el) {
      if (el.defaultValue) {
        el.value = el.defaultValue;
      } else {
        el.value = '';
      }
    });
    $$('input[type="range"]').forEach(function (el) {
      el.value = el.defaultValue || el.getAttribute('value');
    });
    $$('input[type="checkbox"]').forEach(function (el) {
      el.checked = false;
    });
    $$('select').forEach(function (el) {
      el.selectedIndex = 0;
    });
    $$('textarea').forEach(function (el) {
      el.value = '';
    });

    // Reset card selector
    var cards = $$('.card-option');
    cards.forEach(function (c, idx) {
      if (idx === 0) {
        c.classList.add('selected');
        c.setAttribute('aria-checked', 'true');
      } else {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      }
    });
    $('#maintenance-type').value = 'in-house';
    $('#inhouse-fields').classList.remove('hidden');
    $('#inhouse-fields').removeAttribute('hidden');
    $('#outsourced-fields').classList.add('hidden');
    $('#outsourced-fields').setAttribute('hidden', '');

    // Re-init range displays
    initRangeSliders();

    // Hide lead form status
    var status = $('#lead-form-status');
    if (status) status.setAttribute('hidden', '');

    // Show lead form again
    var leadForm = $('#lead-capture-form');
    if (leadForm) leadForm.style.display = '';

    goToStep(1);
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  function init() {
    $steps = $$('.wizard-step');
    $progressSteps = $$('.progress-step');
    $progressBar = $('.progress-bar');
    $resultsSection = $('#results-section');

    // Initialize equipment data
    Equipment.init().then(function () {
      // Equipment data loaded
    });

    // Initialize lead capture
    if (typeof LeadCapture !== 'undefined') {
      LeadCapture.init();
    }

    // Set up all UI interactions
    initCardSelector();
    initRangeSliders();
    initAutomationInfo();
    initAssumptionsToggle();
    initNavigation();

    // Start on step 1
    goToStep(1);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
