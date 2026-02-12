/**
 * Lead Capture Form Handler
 *
 * Manages the lead capture form on the ROI calculator results page.
 * Collects contact info and attaches calculator data as hidden context
 * so Chuck receives the full picture in the email.
 */

(function () {
  'use strict';

  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var calculatorData = null;

  /**
   * Store calculator results so they can be included in the lead submission.
   * Called by app.js after calculation completes.
   *
   * @param {Object} data - Calculator result data
   */
  function setCalculatorData(data) {
    calculatorData = data || null;
  }

  /**
   * Read calculator data from hidden form fields as a fallback when
   * setCalculatorData was never called.
   *
   * @param {HTMLFormElement} form
   * @returns {Object|null}
   */
  function readCalculatorDataFromForm(form) {
    var fields = [
      'propertyType', 'acreage', 'seasonWeeks',
      'maintenanceType',
      'projectedSavings', 'roi', 'paybackPeriod',
      'recommendedEquipment', 'totalInvestment',
      'co2Reduced', 'laborHoursSaved'
    ];

    var data = {};
    var found = false;

    fields.forEach(function (field) {
      var input = form.querySelector('[name="' + field + '"]');
      if (input && input.value !== '') {
        found = true;
        var val = input.value;
        // Attempt numeric conversion for known numeric fields
        if (['acreage', 'seasonWeeks', 'projectedSavings', 'roi',
             'totalInvestment', 'co2Reduced', 'laborHoursSaved'].indexOf(field) !== -1) {
          var num = parseFloat(val);
          if (!isNaN(num)) {
            val = num;
          }
        }
        data[field] = val;
      }
    });

    return found ? data : null;
  }

  /**
   * Read calculator data from the global app state if available.
   *
   * @returns {Object|null}
   */
  function readCalculatorDataFromAppState() {
    if (window.App && window.App.calculatorData) {
      return window.App.calculatorData;
    }
    if (window.Calculator && typeof window.Calculator.getResults === 'function') {
      return window.Calculator.getResults();
    }
    return null;
  }

  /**
   * Collect the best available calculator data from all sources.
   *
   * @param {HTMLFormElement} form
   * @returns {Object}
   */
  function collectCalculatorData(form) {
    // Priority: explicit setCalculatorData > global app state > hidden fields
    if (calculatorData) {
      return calculatorData;
    }

    var appState = readCalculatorDataFromAppState();
    if (appState) {
      return appState;
    }

    var fromForm = readCalculatorDataFromForm(form);
    if (fromForm) {
      return fromForm;
    }

    return {};
  }

  /**
   * Validate the contact fields.
   *
   * @param {Object} fields - { name, email, phone }
   * @returns {string|null} Error message, or null if valid
   */
  function validate(fields) {
    if (!fields.name || fields.name.trim() === '') {
      return 'Please enter your name.';
    }
    if (!fields.email || fields.email.trim() === '') {
      return 'Please enter your email address.';
    }
    if (!EMAIL_REGEX.test(fields.email.trim())) {
      return 'Please enter a valid email address.';
    }
    // Phone is optional; accept any format when provided
    return null;
  }

  /**
   * Submit the lead form data to the server.
   *
   * @param {Object} formData   - Contact fields (name, email, phone, message)
   * @param {Object} calcData   - Calculator results to attach
   * @returns {Promise}
   */
  function submit(formData, calcData) {
    var body = {
      name: (formData.name || '').trim(),
      email: (formData.email || '').trim(),
      phone: (formData.phone || '').trim(),
      message: (formData.message || '').trim(),
      calculatorData: calcData || {}
    };

    return fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Server responded with status ' + response.status);
      }
      return response.json();
    });
  }

  /**
   * Initialise the lead capture form.
   * Called on DOMContentLoaded.
   */
  function init() {
    var form = document.getElementById('lead-capture-form');
    if (!form) {
      return;
    }

    var statusEl = document.getElementById('lead-form-status');
    var statusMsg = document.getElementById('lead-status-message');
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalBtnHTML = submitBtn ? submitBtn.innerHTML : 'Request Custom Proposal';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Hide any previous messages
      if (statusEl) statusEl.setAttribute('hidden', '');

      // Gather contact fields
      var fields = {
        name: (document.getElementById('lead-name') && document.getElementById('lead-name').value) || '',
        email: (document.getElementById('lead-email') && document.getElementById('lead-email').value) || '',
        phone: (document.getElementById('lead-phone') && document.getElementById('lead-phone').value) || '',
        message: (document.getElementById('lead-message') && document.getElementById('lead-message').value) || ''
      };

      // Validate
      var validationError = validate(fields);
      if (validationError) {
        if (statusEl && statusMsg) {
          statusMsg.textContent = validationError;
          statusEl.className = 'form-status form-error';
          statusEl.removeAttribute('hidden');
        }
        return;
      }

      // Show loading state and prevent double-submit
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      // Collect calculator data from all available sources
      var calcData = collectCalculatorData(form);

      // Submit
      submit(fields, calcData)
        .then(function () {
          // Success: clear form, show success message, hide form
          form.reset();
          form.style.display = 'none';
          if (statusEl && statusMsg) {
            statusMsg.textContent = 'Thank you! Chuck will be in touch within 24 hours.';
            statusEl.className = 'form-status form-success';
            statusEl.removeAttribute('hidden');
          }
        })
        .catch(function () {
          // Error: show error message, restore button
          if (statusEl && statusMsg) {
            statusMsg.textContent = 'Something went wrong. Please try again or call us directly.';
            statusEl.className = 'form-status form-error';
            statusEl.removeAttribute('hidden');
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
          }
        });
    });
  }

  // Auto-initialise when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.LeadCapture = {
    init: init,
    submit: submit,
    setCalculatorData: setCalculatorData
  };
})();
