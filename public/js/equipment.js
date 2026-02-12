/**
 * Equipment Recommendation Engine
 * Autonomous Mowing Solutions ROI Calculator
 *
 * Loads product data from /data/equipment.json and recommends
 * the right Husqvarna Automower configuration based on property inputs.
 *
 * Usage:
 *   await Equipment.init();
 *   const result = Equipment.recommend('commercial', 10, 80);
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Fallback data -- used when equipment.json cannot be fetched
  // ---------------------------------------------------------------------------
  var FALLBACK_DATA = {
    models: [
      {
        id: '520-epos',
        name: 'Husqvarna Automower 520 EPOS',
        shortName: '520 EPOS',
        price: 3299.99,
        coverage: 1.25,
        description: 'Best for small commercial properties',
        terrain: 'flat',
        categories: ['commercial']
      },
      {
        id: '520h-epos',
        name: 'Husqvarna Automower 520H EPOS',
        shortName: '520H EPOS',
        price: 3299.99,
        coverage: 1.25,
        description: 'Best for hilly commercial properties and golf courses',
        terrain: 'hilly',
        categories: ['commercial', 'golf']
      },
      {
        id: '535-awd-epos',
        name: 'Husqvarna Automower 535 AWD EPOS',
        shortName: '535 AWD EPOS',
        price: 4999.99,
        coverage: 1.25,
        description: 'Best for rough terrain and challenging landscapes',
        terrain: 'rough',
        categories: ['commercial']
      },
      {
        id: '550-epos',
        name: 'Husqvarna Automower 550 EPOS',
        shortName: '550 EPOS',
        price: 5829.99,
        coverage: 2.5,
        description: 'Best for large commercial properties and athletic fields',
        terrain: 'flat',
        categories: ['commercial', 'athletic']
      },
      {
        id: '550h-epos',
        name: 'Husqvarna Automower 550H EPOS',
        shortName: '550H EPOS',
        price: 5299.99,
        coverage: 2.5,
        description: 'Best for large hilly properties and golf courses',
        terrain: 'hilly',
        categories: ['commercial', 'golf']
      }
    ],

    accessories: {
      referenceStation: {
        name: 'EPOS RS5 Reference Station',
        price: 899.99,
        perSite: true
      },
      housing: {
        name: 'Automower House (400/500 series)',
        price: 171.99,
        perUnit: true
      }
    },

    services: {
      annualMaintenance: {
        name: 'Annual Onsite Maintenance',
        price: 249.00,
        perUnit: true
      },
      remoteSupport: {
        name: 'Remote Support',
        price: 94.99,
        perUnit: false
      },
      winterStorage: {
        name: 'Winter Storage & Service',
        price: 149.99,
        perUnit: true
      }
    },

    installation: {
      perUnit: {
        name: 'Site Installation & Mapping',
        price: 1500
      },
      flat: {
        name: 'Training & App Configuration',
        price: 500
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------
  var _data = null;
  var _initialized = false;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Format a number as US currency.
   * @param {number} num
   * @returns {string} e.g. "$5,829.99"
   */
  function formatCurrency(num) {
    if (typeof num !== 'number' || isNaN(num)) {
      return '$0.00';
    }
    return '$' + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  }

  /**
   * Look up a model object by its shortName.
   * @param {string} shortName
   * @returns {object|null}
   */
  function getModelByShortName(shortName) {
    if (!_data || !_data.models) return null;
    for (var i = 0; i < _data.models.length; i++) {
      if (_data.models[i].shortName === shortName) {
        return _data.models[i];
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Core recommendation logic
  // ---------------------------------------------------------------------------

  /**
   * Recommend equipment based on property parameters.
   *
   * @param {string}  propertyType     - 'commercial', 'athletic', or 'golf'
   * @param {number}  acreage          - total property acreage
   * @param {number}  automationLevel  - percentage (0-100) of property to automate
   * @param {boolean} [isHilly=false]  - whether the terrain is hilly
   * @returns {object} recommendation object (see module docs for shape)
   */
  function recommendEquipment(propertyType, acreage, automationLevel, isHilly) {
    if (!_data) {
      _data = FALLBACK_DATA;
    }

    // Sanitize inputs
    acreage = Math.max(0, Number(acreage) || 0);
    automationLevel = Math.min(100, Math.max(0, Number(automationLevel) || 0));
    isHilly = !!isHilly;
    propertyType = (propertyType || 'commercial').toLowerCase();

    // Target acreage to be mowed autonomously
    var targetAcreage = acreage * (automationLevel / 100);

    // ---- Model selection ----
    var modelShortName;

    if (propertyType === 'golf' || isHilly) {
      // Hilly / golf terrain -- use H-series
      if (targetAcreage <= 2) {
        modelShortName = '520H EPOS';
      } else {
        modelShortName = '550H EPOS';
      }
    } else {
      // Commercial or athletic, flat terrain
      if (targetAcreage <= 2) {
        modelShortName = '520 EPOS';
      } else {
        modelShortName = '550 EPOS';
      }
    }

    var model = getModelByShortName(modelShortName);

    // Safety: fall back to first model if lookup somehow fails
    if (!model) {
      model = _data.models[0];
    }

    // ---- Units needed ----
    var unitsNeeded = Math.ceil(targetAcreage / model.coverage);
    unitsNeeded = Math.max(1, unitsNeeded);

    // ---- Cost calculations ----
    var equipmentCost = unitsNeeded * model.price;
    var referenceStationCost = _data.accessories.referenceStation.price;  // 1 per site
    var housingCost = unitsNeeded * _data.accessories.housing.price;
    var totalEquipmentCost = equipmentCost + referenceStationCost + housingCost;

    var installationCost = unitsNeeded * _data.installation.perUnit.price;
    var setupCost = _data.installation.flat.price;

    var annualMaintenanceCost = unitsNeeded * _data.services.annualMaintenance.price;
    var remoteSupportCost = _data.services.remoteSupport.price;
    var winterStorageCost = unitsNeeded * _data.services.winterStorage.price;
    var annualServiceCost = annualMaintenanceCost + remoteSupportCost + winterStorageCost;

    var totalInvestment = totalEquipmentCost + installationCost + setupCost;

    // ---- Build the label suffix for quantities > 1 ----
    var unitSuffix = unitsNeeded > 1 ? ' \u00d7 ' + unitsNeeded : '';

    // ---- Assemble return object ----
    return {
      model: {
        name: model.name,
        shortName: model.shortName,
        price: model.price,
        coverage: model.coverage,
        description: model.description
      },

      unitsNeeded: unitsNeeded,
      targetAcreage: targetAcreage,

      costs: {
        mowers: equipmentCost,
        referenceStation: referenceStationCost,
        housing: housingCost,
        installation: installationCost,
        setup: setupCost,
        totalEquipment: totalEquipmentCost,
        totalInvestment: totalInvestment,
        annualService: annualServiceCost
      },

      breakdown: [
        {
          label: model.name + unitSuffix,
          amount: equipmentCost
        },
        {
          label: _data.accessories.referenceStation.name,
          amount: referenceStationCost
        },
        {
          label: _data.accessories.housing.name + unitSuffix,
          amount: housingCost
        },
        {
          label: _data.installation.perUnit.name + unitSuffix,
          amount: installationCost
        },
        {
          label: _data.installation.flat.name,
          amount: setupCost
        }
      ],

      annualBreakdown: [
        {
          label: _data.services.annualMaintenance.name + unitSuffix,
          amount: annualMaintenanceCost
        },
        {
          label: _data.services.remoteSupport.name,
          amount: remoteSupportCost
        },
        {
          label: _data.services.winterStorage.name + unitSuffix,
          amount: winterStorageCost
        }
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize the equipment module by loading data from the JSON file.
   * Falls back to hardcoded data if the fetch fails for any reason.
   *
   * @returns {Promise<void>}
   */
  function init() {
    if (_initialized) {
      return Promise.resolve();
    }

    return fetch('/data/equipment.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (json) {
        // Basic validation: make sure we have the expected shape
        if (json && Array.isArray(json.models) && json.models.length > 0) {
          _data = json;
        } else {
          console.warn('[Equipment] JSON loaded but has unexpected shape. Using fallback data.');
          _data = FALLBACK_DATA;
        }
        _initialized = true;
      })
      .catch(function (err) {
        console.warn('[Equipment] Could not load equipment.json, using fallback data.', err);
        _data = FALLBACK_DATA;
        _initialized = true;
      });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Equipment = {
    /**
     * Initialize the equipment module (load JSON data).
     * @returns {Promise<void>}
     */
    init: init,

    /**
     * Generate an equipment recommendation.
     * @param {string}  propertyType    - 'commercial', 'athletic', or 'golf'
     * @param {number}  acreage         - total property acreage
     * @param {number}  automationLevel - percentage (0-100)
     * @param {boolean} [isHilly=false] - hilly terrain flag
     * @returns {object} recommendation object
     */
    recommend: function (propertyType, acreage, automationLevel, isHilly) {
      return recommendEquipment(propertyType, acreage, automationLevel, isHilly);
    },

    /**
     * Format a number as US currency string.
     * @param {number} num
     * @returns {string} e.g. "$5,829.99"
     */
    formatCurrency: formatCurrency,

    /**
     * Get the raw equipment data (models, accessories, services, installation).
     * Returns null if init() has not been called yet.
     * @returns {object|null}
     */
    getData: function () {
      return _data;
    },

    /**
     * Get all available models.
     * @returns {Array}
     */
    getModels: function () {
      return _data ? _data.models : FALLBACK_DATA.models;
    },

    /**
     * Look up a model by its shortName.
     * @param {string} shortName - e.g. "550 EPOS"
     * @returns {object|null}
     */
    getModel: function (shortName) {
      return getModelByShortName(shortName);
    }
  };
})();
