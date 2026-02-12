/**
 * Autonomous ROI Calculator Engine
 *
 * Pure calculation functions for robotic mowing ROI analysis.
 * No DOM manipulation -- all functions take inputs and return outputs.
 */
const Calculator = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Property-type defaults
  // ---------------------------------------------------------------------------

  const PROPERTY_DEFAULTS = {
    commercial: { mowingTimePerAcre: 45, mowsPerWeek: 1, fuelPerAcre: 0.75 },
    golf:       { mowingTimePerAcre: 60, mowsPerWeek: 3, fuelPerAcre: 1.0 },
    athletic:   { mowingTimePerAcre: 50, mowsPerWeek: 2, fuelPerAcre: 0.85 }
  };

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Round a number to the given decimal places. */
  function round(value, decimals) {
    if (decimals === undefined) decimals = 2;
    var factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /** Clamp a number between min and max (inclusive). */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Resolve all inputs, applying defaults where values are missing.
   * Returns a new plain object -- never mutates the original.
   */
  function resolveInputs(raw) {
    var pt = raw.propertyType || 'commercial';
    var propDefaults = PROPERTY_DEFAULTS[pt] || PROPERTY_DEFAULTS.commercial;

    return {
      // Step 1
      propertyType:        pt,
      acreage:             Math.max(Number(raw.acreage) || 0, 0),
      seasonWeeks:         Math.max(Number(raw.seasonWeeks) || 30, 1),
      mowsPerWeek:         propDefaults.mowsPerWeek,

      // Step 2
      maintenanceType:     raw.maintenanceType === 'outsourced' ? 'outsourced' : 'inhouse',

      // In-house fields
      employees:           Math.max(Number(raw.employees) || 0, 0),
      hourlyRate:          Math.max(Number(raw.hourlyRate) || 0, 0),
      mowingTimePercent:   clamp(Number(raw.mowingTimePercent) || 0, 0, 100),
      isLeased:            Boolean(raw.isLeased),

      // Outsourced fields
      monthlyContract:     Math.max(Number(raw.monthlyContract) || 0, 0),

      // Assumptions
      benefitsRate:        clamp(Number(raw.benefitsRate  !== undefined ? raw.benefitsRate  : 12),  0, 100),
      fuelCostPerGallon:   Math.max(Number(raw.fuelCostPerGallon !== undefined ? raw.fuelCostPerGallon : 3.50), 0),
      laborReduction:      clamp(Number(raw.laborReduction !== undefined ? raw.laborReduction : 85), 50, 95),
      bufferTime:          clamp(Number(raw.bufferTime !== undefined ? raw.bufferTime : 15), 5, 40),
      annualLaborIncrease: clamp(Number(raw.annualLaborIncrease !== undefined ? raw.annualLaborIncrease : 2.5), 0, 10),
      fuelPerAcre:         Math.max(Number(raw.fuelPerAcre !== undefined ? raw.fuelPerAcre : propDefaults.fuelPerAcre), 0),
      annualFuelIncrease:  clamp(Number(raw.annualFuelIncrease !== undefined ? raw.annualFuelIncrease : 3.5), 0, 15),
      baseEquipmentCost:   Math.max(Number(raw.baseEquipmentCost !== undefined ? raw.baseEquipmentCost : 15000), 0),
      equipmentCostPerAcre:Math.max(Number(raw.equipmentCostPerAcre !== undefined ? raw.equipmentCostPerAcre : 2000), 0),
      maintenanceRate:     clamp(Number(raw.maintenanceRate !== undefined ? raw.maintenanceRate : 10), 5, 25),
      insuranceRate:       clamp(Number(raw.insuranceRate !== undefined ? raw.insuranceRate : 5), 1, 15),
      leasingPremium:      clamp(Number(raw.leasingPremium !== undefined ? raw.leasingPremium : 7), 0, 20),
      roboticMaintenance:  Math.max(Number(raw.roboticMaintenance !== undefined ? raw.roboticMaintenance : 3), 0),
      electricityPerAcre:  Math.max(Number(raw.electricityPerAcre !== undefined ? raw.electricityPerAcre : 1.5), 0),
      co2PerGallon:        Math.max(Number(raw.co2PerGallon !== undefined ? raw.co2PerGallon : 19.59), 0),
      mowingTimePerAcre:   Math.max(Number(raw.mowingTimePerAcre !== undefined ? raw.mowingTimePerAcre : propDefaults.mowingTimePerAcre), 0),

      // Step 3
      automationLevel:     clamp(Number(raw.automationLevel !== undefined ? raw.automationLevel : 50), 25, 100),
      desiredMowingTime:   clamp(Number(raw.desiredMowingTime !== undefined ? raw.desiredMowingTime : 20), 5, 60)
    };
  }

  // ---------------------------------------------------------------------------
  // Main calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate the full ROI analysis for robotic mowing.
   *
   * @param {Object} rawInputs - User-supplied inputs. Missing values will use
   *   sensible defaults derived from the selected property type.
   *
   * @returns {Object} result
   * @returns {Object} result.currentCosts        - { labor, fuel, equipment, total }
   * @returns {Object} result.savings              - { labor, fuel, equipment, gross }
   * @returns {Object} result.newCosts             - { maintenance, electricity, total }
   * @returns {number} result.netAnnualSavings
   * @returns {Object} result.labor                - { currentHours, hoursSaved, currentFTE, reducedFTE }
   * @returns {Object} result.environmental        - { co2Reduced, fuelGallonsSaved, treeEquivalents, noiseReduction }
   * @returns {Object} result.inputs               - Fully resolved inputs with all defaults applied
   * @returns {Function} result.withInvestment     - (totalInvestment, annualServiceCost) => metrics
   */
  function calculateROI(rawInputs) {
    var i = resolveInputs(rawInputs || {});

    // ------ Current Annual Costs ------

    var laborCost, fuelCost, equipmentAnnualCost;

    if (i.maintenanceType === 'outsourced') {
      laborCost           = i.monthlyContract * 12;
      fuelCost            = 0;
      equipmentAnnualCost = 0;
    } else {
      // In-house
      laborCost = i.employees
        * i.hourlyRate
        * (1 + i.benefitsRate / 100)
        * 40
        * i.seasonWeeks
        * (i.mowingTimePercent / 100)
        * (1 + i.bufferTime / 100);

      fuelCost = i.acreage
        * i.fuelPerAcre
        * i.mowsPerWeek
        * i.seasonWeeks
        * i.fuelCostPerGallon;

      var equipmentBaseCost = i.baseEquipmentCost + (i.equipmentCostPerAcre * i.acreage);
      equipmentAnnualCost = equipmentBaseCost * (i.maintenanceRate / 100 + i.insuranceRate / 100);
      if (i.isLeased) {
        equipmentAnnualCost *= (1 + i.leasingPremium / 100);
      }
    }

    laborCost           = round(laborCost);
    fuelCost            = round(fuelCost);
    equipmentAnnualCost = round(equipmentAnnualCost);

    var totalCurrentCost = round(laborCost + fuelCost + equipmentAnnualCost);

    // ------ Savings from Automation ------

    var laborSavings, fuelSavings, equipmentSavings;

    if (i.maintenanceType === 'outsourced') {
      laborSavings     = round(laborCost * (i.automationLevel / 100) * 0.85);
      fuelSavings      = 0;
      equipmentSavings = 0;
    } else {
      laborSavings     = round(laborCost * (i.automationLevel / 100) * (i.laborReduction / 100));
      fuelSavings      = round(fuelCost * (i.automationLevel / 100));
      equipmentSavings = round(equipmentAnnualCost * (i.automationLevel / 100) * 0.5);
    }

    var grossSavings = round(laborSavings + fuelSavings + equipmentSavings);

    // ------ New Robotic Costs ------

    var roboticMaintenanceCost = round(
      i.acreage * (i.automationLevel / 100) * i.roboticMaintenance * 12
    );

    var electricityCost = round(
      i.acreage * (i.automationLevel / 100) * i.electricityPerAcre * 0.12 * i.mowsPerWeek * i.seasonWeeks
    );

    var totalNewCosts = round(roboticMaintenanceCost + electricityCost);

    // ------ Key Results ------

    var netAnnualSavings = round(grossSavings - totalNewCosts);

    // ------ Labor Analysis ------

    var currentMowingHours = Math.round(
      i.acreage * (i.mowingTimePerAcre / 60) * i.mowsPerWeek * i.seasonWeeks
    );

    var laborHoursSaved = Math.round(
      currentMowingHours * (i.automationLevel / 100) * (i.laborReduction / 100)
    );

    var currentFTE = i.maintenanceType === 'outsourced' ? 0 : i.employees;
    var reducedFTE = i.maintenanceType === 'outsourced'
      ? 0
      : Math.max(0, round(currentFTE * (1 - (i.automationLevel / 100) * (i.laborReduction / 100)), 1));

    // ------ Environmental Impact ------

    var co2Reduced = round(
      i.acreage * (i.automationLevel / 100) * i.fuelPerAcre * i.co2PerGallon * i.mowsPerWeek * i.seasonWeeks
    );

    var fuelGallonsSaved = round(
      i.acreage * (i.automationLevel / 100) * i.fuelPerAcre * i.mowsPerWeek * i.seasonWeeks
    );

    var treeEquivalents = round(co2Reduced / 48);

    // ------ Assemble Result ------

    return {
      currentCosts: {
        labor:     laborCost,
        fuel:      fuelCost,
        equipment: equipmentAnnualCost,
        total:     totalCurrentCost
      },

      savings: {
        labor:     laborSavings,
        fuel:      fuelSavings,
        equipment: equipmentSavings,
        gross:     grossSavings
      },

      newCosts: {
        maintenance: roboticMaintenanceCost,
        electricity: electricityCost,
        total:       totalNewCosts
      },

      netAnnualSavings: netAnnualSavings,

      labor: {
        currentHours: currentMowingHours,
        hoursSaved:   laborHoursSaved,
        currentFTE:   currentFTE,
        reducedFTE:   reducedFTE
      },

      environmental: {
        co2Reduced:      co2Reduced,
        fuelGallonsSaved: fuelGallonsSaved,
        treeEquivalents: treeEquivalents,
        noiseReduction:  30
      },

      inputs: i,

      // Internal values needed by projection & withInvestment
      _internal: {
        laborCost:              laborCost,
        fuelCost:               fuelCost,
        equipmentAnnualCost:    equipmentAnnualCost,
        roboticMaintenanceCost: roboticMaintenanceCost,
        electricityCost:        electricityCost,
        totalNewCosts:          totalNewCosts
      },

      /**
       * Complete the ROI metrics once the equipment investment is known.
       *
       * @param {number} totalInvestment   - Up-front equipment cost ($).
       * @param {number} annualServiceCost - Optional recurring service cost ($/year).
       * @returns {Object} { roi, paybackYears, paybackMonths, totalInvestment, annualServiceCost }
       */
      withInvestment: function (totalInvestment, annualServiceCost) {
        totalInvestment   = Math.max(Number(totalInvestment)   || 0, 0);
        annualServiceCost = Math.max(Number(annualServiceCost) || 0, 0);

        var effectiveSavings = netAnnualSavings - annualServiceCost;

        var roi, paybackYears, paybackMonths;

        if (totalInvestment === 0) {
          roi           = effectiveSavings > 0 ? Infinity : 0;
          paybackYears  = 0;
          paybackMonths = 0;
        } else if (effectiveSavings <= 0) {
          roi           = round((effectiveSavings / totalInvestment) * 100);
          paybackYears  = Infinity;
          paybackMonths = Infinity;
        } else {
          roi           = round((effectiveSavings / totalInvestment) * 100);
          paybackYears  = round(totalInvestment / effectiveSavings, 2);
          paybackMonths = round(paybackYears * 12, 1);
        }

        return {
          roi:                roi,
          paybackYears:       paybackYears,
          paybackMonths:      paybackMonths,
          totalInvestment:    totalInvestment,
          annualServiceCost:  annualServiceCost
        };
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 5-Year Projection
  // ---------------------------------------------------------------------------

  /**
   * Build a 5-year cost and savings projection.
   *
   * @param {Object} baseResults       - The object returned by calculateROI().
   * @param {number} totalInvestment   - Up-front equipment investment ($).
   * @param {number} [annualServiceCost=0] - Recurring annual service cost ($/year).
   *
   * @returns {Array<Object>} Five objects (year 1-5), each containing:
   *   { year, laborMultiplier, fuelMultiplier,
   *     traditionalCost, automatedCost,
   *     annualSavings, cumulativeTraditional, cumulativeAutomated, cumulativeSavings }
   */
  function calculateProjection(baseResults, totalInvestment, annualServiceCost) {
    totalInvestment   = Math.max(Number(totalInvestment)   || 0, 0);
    annualServiceCost = Math.max(Number(annualServiceCost) || 0, 0);

    var i   = baseResults.inputs;
    var raw = baseResults._internal;

    var laborCost           = raw.laborCost;
    var fuelCost            = raw.fuelCost;
    var equipmentAnnualCost = raw.equipmentAnnualCost;
    var totalNewCosts       = raw.totalNewCosts;

    var projection        = [];
    var cumTraditional    = 0;
    var cumAutomated      = 0;

    for (var year = 1; year <= 5; year++) {
      var laborMultiplier = Math.pow(1 + i.annualLaborIncrease / 100, year);
      var fuelMultiplier  = Math.pow(1 + i.annualFuelIncrease  / 100, year);

      // Traditional (status-quo) cost for this year
      var traditionalCost = round(
        (laborCost * laborMultiplier)
        + (fuelCost * fuelMultiplier)
        + equipmentAnnualCost
      );

      // Automated cost for this year
      var automatedCost = round(
        (laborCost * (1 - (i.automationLevel / 100) * (i.laborReduction / 100)) * laborMultiplier)
        + (fuelCost * (1 - i.automationLevel / 100) * fuelMultiplier)
        + (equipmentAnnualCost * (1 - (i.automationLevel / 100) * 0.5))
        + totalNewCosts
        + annualServiceCost
      );

      var annualSavings = round(traditionalCost - automatedCost);

      cumTraditional += traditionalCost;
      cumAutomated   += automatedCost;

      // Investment is added only in year 1
      var cumAutomatedWithInvestment = cumAutomated + (year >= 1 ? totalInvestment : 0);
      // Since we add totalInvestment once in year 1 and it persists in cumulative:
      // We handle it by adding it only once outside the loop -- but since we are
      // inside the loop, add it to the running total after year 1 calculation.

      projection.push({
        year:                 year,
        laborMultiplier:      round(laborMultiplier, 4),
        fuelMultiplier:       round(fuelMultiplier, 4),
        traditionalCost:      traditionalCost,
        automatedCost:        automatedCost,
        annualSavings:        annualSavings,
        cumulativeTraditional: round(cumTraditional),
        cumulativeAutomated:  round(cumAutomated + totalInvestment),
        cumulativeSavings:    round(cumTraditional - (cumAutomated + totalInvestment))
      });
    }

    return projection;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    PROPERTY_DEFAULTS:    PROPERTY_DEFAULTS,
    calculateROI:         calculateROI,
    calculateProjection:  calculateProjection
  };

})();

// Make available on window for non-module environments
if (typeof window !== 'undefined') {
  window.Calculator = Calculator;
}

// Support CommonJS / Node for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calculator;
}
