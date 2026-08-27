
  (function () {
  var FORM_ID = '6482561';
  var API_AUTH_TOKEN = '5c95e121eeeea41daa9f303a74e0f4afea08a00d6ef40102e758771e515da493';

  var VALIDATE_SERIAL_URL    = 'https://api-staging.puffco.com/formstack-v1/validate-serial-number';
  var PRODUCT_STATUS_URL     = 'https://api-staging.puffco.com/formstack-v1/product-status';
  var USER_REGISTRATIONS_URL = 'https://api-staging.puffco.com/formstack-v1/user-registrations';

  var FIELD_EMAIL           = '194283379';
  var FIELD_SERIAL_NUMBER   = '194283381';
  var FIELD_ERROR_MESSAGE   = '197229604';

  var HIDDEN_REGISTERED_USER_ID = '197276710';
  var FIELD_DEVICE_DISPLAY = '197276699';
  var FIELD_IS_THIS_YOUR_DEVICE = '195793109';
  var FIELD_SECOND_BLOCKER = '197804757';
  var FIELD_REQUESTING_TRANSFER = '197799571';

  var BLOCKER_PAGE = 2;

  var form = window.fsApi().getForm(FORM_ID);
  var allowNextNavigation = false;

  function goToNextPageForReal() {
    allowNextNavigation = true;
    return form.goToNextPage();
  }

  function fv(fieldId) {
    var field = form.getField(fieldId);
    return field ? (field.getValue().value || '') : '';
  }

  function setFv(fieldId, value) {
    var field = form.getField(fieldId);
    if (field) field.setValue({ value: value });
  }

  function showMessage(fieldId, text, color) {
    var field = form.getField(fieldId);
    if (!field) return;
    field.setTypeAttribute(
      'content',
      '<div style="color: ' + (color || '#c0392b') + ';">' + (text || '') + '</div>'
    );
  }

  function clearMessage(fieldId) {
    showMessage(fieldId, '', '#000000');
  }

  function setDescriptionText(fieldId, text) {
    var field = form.getField(fieldId);
    if (!field) return;
    field.setTypeAttribute('content', '<div>' + (text || '') + '</div>');
  }

  function showSpinner(fieldId, text) {
    var field = form.getField(fieldId);
    if (!field) return;
    var spinnerSvg =
      '<svg width="18" height="18" viewBox="0 0 50 50" style="vertical-align:middle;margin-right:8px;">' +
      '<circle cx="25" cy="25" r="20" fill="none" stroke="#999" stroke-width="5" ' +
      'stroke-linecap="round" stroke-dasharray="90,150">' +
      '<animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" ' +
      'dur="1s" repeatCount="indefinite"/>' +
      '</circle></svg>';
    field.setTypeAttribute(
      'content',
      '<div style="color:#555;">' + spinnerSvg + (text || 'Checking...') + '</div>'
    );
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'api-token': API_AUTH_TOKEN
    };
  }

  function currentPage() {
    try {
      var ctx = form.getPagingContext();
      return ctx && ctx.currentPage ? ctx.currentPage : null;
    } catch (e) {
      return null;
    }
  }

  function isBlocked() {
    return fv(FIELD_IS_THIS_YOUR_DEVICE).trim() === 'No' ||
           fv(FIELD_SECOND_BLOCKER).trim() === 'No';
  }

  function writeNextButtonVisibility(visible) {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent.trim() === 'Next') {
        buttons[i].style.display = visible ? '' : 'none';
      }
    }
  }

  function syncNextButton(pageOverride) {
    var page = pageOverride != null ? pageOverride : currentPage();
    var shouldHide = (page === BLOCKER_PAGE) && isBlocked();
    writeNextButtonVisibility(!shouldHide);
  }

  function syncNextButtonSoon(pageOverride) {
    setTimeout(function () { syncNextButton(pageOverride); }, 60);
    setTimeout(function () { syncNextButton(pageOverride); }, 250);
  }

  function runValidationChain() {
    var email = fv(FIELD_EMAIL).trim();
    var serialNumber = fv(FIELD_SERIAL_NUMBER).trim();

    clearMessage(FIELD_ERROR_MESSAGE);
    setFv(HIDDEN_REGISTERED_USER_ID, '');
    setFv(FIELD_REQUESTING_TRANSFER, 'No');

    if (!email || !serialNumber) return;

    showSpinner(FIELD_ERROR_MESSAGE, 'Checking your serial number...');

    fetch(VALIDATE_SERIAL_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ serial_number: serialNumber })
    })
      .then(function (res) { return res.json(); })
      .then(function (validateData) {
        if (!validateData.is_recognized) {
          showMessage(FIELD_ERROR_MESSAGE, 'This serial number is not in a valid format. Please check the number and try again. If still having issues, please contact Puffco support at www.puffco.com/pages/contact.');
          return;
        }

        var productName = validateData.product_name || '';

        return fetch(PRODUCT_STATUS_URL + '?serial_number=' + encodeURIComponent(serialNumber), {
          method: 'GET',
          headers: authHeaders()
        })
          .then(function (res2) { return res2.json(); })
          .then(function (statusData) {
            function advance() {
              return goToNextPageForReal().then(function () {
                clearMessage(FIELD_ERROR_MESSAGE);
                setDescriptionText(FIELD_DEVICE_DISPLAY, productName);
                syncNextButtonSoon(BLOCKER_PAGE);
              });
            }

            if (!statusData.is_registered) {
              return advance();
            }

            var registeredUserId = statusData.registered_user ? statusData.registered_user.id : null;
            setFv(HIDDEN_REGISTERED_USER_ID, registeredUserId != null ? String(registeredUserId) : '');

            return fetch(USER_REGISTRATIONS_URL + '?email=' + encodeURIComponent(email), {
              method: 'GET',
              headers: authHeaders()
            })
              .then(function (res3) { return res3.json(); })
              .then(function (usersData) {
                var lookedUpUserId = usersData.user ? usersData.user.id : null;

                var isSameUser =
                  lookedUpUserId != null &&
                  registeredUserId != null &&
                  String(lookedUpUserId) === String(registeredUserId);

                if (!isSameUser) {
                  setFv(FIELD_REQUESTING_TRANSFER, 'Yes');
                }

                return advance();
              });
          });
      })
      .catch(function () {
        showMessage(FIELD_ERROR_MESSAGE, 'Something went wrong checking this serial number. Please try again.');
      });
  }

  form.registerFormEventListener({
    type: 'change',
    onFormEvent: function (event) {
      if (event.data.fieldId === FIELD_IS_THIS_YOUR_DEVICE || event.data.fieldId === FIELD_SECOND_BLOCKER) {
        syncNextButtonSoon();
      }
      return Promise.resolve(event);
    }
  });

  form.registerFormEventListener({
    type: 'change-page',
    onFormEvent: function (event) {
      var destination = event.data ? event.data.destinationPage : null;

      if (allowNextNavigation) {
        allowNextNavigation = false;
        syncNextButtonSoon(destination);
        return Promise.resolve(event);
      }

      if (event.data && event.data.sourcePage === 1) {
        event.preventDefault();
        runValidationChain();
        return Promise.resolve(event);
      }

      if (event.data && event.data.sourcePage === BLOCKER_PAGE) {
        var isMovingForward = event.data.destinationPage > event.data.sourcePage;
        if (isBlocked() && isMovingForward) {
          event.preventDefault();
          syncNextButtonSoon(BLOCKER_PAGE);
          return Promise.resolve(event);
        }
        syncNextButtonSoon(destination);
        return Promise.resolve(event);
      }

      syncNextButtonSoon(destination);
      return Promise.resolve(event);
    }
  });

  syncNextButtonSoon();
})();
