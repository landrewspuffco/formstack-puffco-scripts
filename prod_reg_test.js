
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

  var log = [];

  function say(msg) {
    log.push(msg);
    if (log.length > 14) log.shift();
    render();
  }

  function render() {
    var field = form.getField(FIELD_ERROR_MESSAGE);
    if (!field) return;
    field.setTypeAttribute(
      'content',
      '<div style="font:11px/1.5 monospace;color:#0a0;text-align:left;">' +
        log.join('<br>') +
      '</div>'
    );
  }

  function buttonReport() {
    var buttons = document.querySelectorAll('button');
    var parts = [];
    for (var i = 0; i < buttons.length; i++) {
      var txt = (buttons[i].textContent || '').trim();
      if (!txt) txt = '(no text)';
      var disp = buttons[i].style.display === '' ? 'default' : buttons[i].style.display;
      parts.push(txt + '[' + disp + ']');
    }
    return parts.length ? parts.join(' ') : 'NO BUTTONS IN DOM';
  }

  function pagingReport() {
    try {
      var ctx = form.getPagingContext();
      if (!ctx) return 'ctx=null';
      return 'ctx page=' + ctx.currentPage + '/' + ctx.totalPages;
    } catch (e) {
      return 'ctx THREW: ' + e.message;
    }
  }

  function snapshot(label) {
    setTimeout(function () {
      say(label + ' | ' + pagingReport());
      say('  btns: ' + buttonReport());
    }, 300);
  }

  function fv(fieldId) {
    var field = form.getField(fieldId);
    return field ? (field.getValue().value || '') : '';
  }

  function setFv(fieldId, value) {
    var field = form.getField(fieldId);
    if (field) field.setValue({ value: value });
  }

  function setDescriptionText(fieldId, text) {
    var field = form.getField(fieldId);
    if (!field) return;
    field.setTypeAttribute('content', '<div>' + (text || '') + '</div>');
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'api-token': API_AUTH_TOKEN
    };
  }

  function isBlocked() {
    return fv(FIELD_IS_THIS_YOUR_DEVICE).trim() === 'No' ||
           fv(FIELD_SECOND_BLOCKER).trim() === 'No';
  }

  function goToNextPageForReal() {
    allowNextNavigation = true;
    say('calling goToNextPage()');
    return form.goToNextPage();
  }

  function runValidationChain() {
    var email = fv(FIELD_EMAIL).trim();
    var serialNumber = fv(FIELD_SERIAL_NUMBER).trim();

    setFv(HIDDEN_REGISTERED_USER_ID, '');
    setFv(FIELD_REQUESTING_TRANSFER, 'No');

    if (!email || !serialNumber) {
      say('MISSING email or serial - chain aborted');
      return;
    }

    say('validating ' + serialNumber);

    fetch(VALIDATE_SERIAL_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ serial_number: serialNumber })
    })
      .then(function (res) { return res.json(); })
      .then(function (validateData) {
        if (!validateData.is_recognized) {
          say('serial NOT recognized - staying on page 1');
          return;
        }

        var productName = validateData.product_name || '';
        say('recognized: ' + productName);

        return fetch(PRODUCT_STATUS_URL + '?serial_number=' + encodeURIComponent(serialNumber), {
          method: 'GET',
          headers: authHeaders()
        })
          .then(function (res2) { return res2.json(); })
          .then(function (statusData) {
            function advance() {
              return goToNextPageForReal().then(function () {
                say('goToNextPage resolved');
                setDescriptionText(FIELD_DEVICE_DISPLAY, productName);
                snapshot('after advance');
              });
            }

            if (!statusData.is_registered) {
              say('not registered');
              return advance();
            }

            var registeredUserId = statusData.registered_user ? statusData.registered_user.id : null;
            setFv(HIDDEN_REGISTERED_USER_ID, registeredUserId != null ? String(registeredUserId) : '');
            say('already registered, owner=' + registeredUserId);

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
                say('lookup=' + lookedUpUserId + ' same=' + isSameUser);
                if (!isSameUser) setFv(FIELD_REQUESTING_TRANSFER, 'Yes');
                return advance();
              });
          });
      })
      .catch(function (e) {
        say('CHAIN ERROR: ' + e.message);
      });
  }

  form.registerFormEventListener({
    type: 'change',
    onFormEvent: function (event) {
      if (event.data.fieldId === FIELD_IS_THIS_YOUR_DEVICE || event.data.fieldId === FIELD_SECOND_BLOCKER) {
        say('blocker field changed, blocked=' + isBlocked());
        snapshot('after blocker change');
      }
      return Promise.resolve(event);
    }
  });

  form.registerFormEventListener({
    type: 'change-page',
    onFormEvent: function (event) {
      var d = event.data || {};
      say('change-page src=' + d.sourcePage + ' dest=' + d.destinationPage + ' bypass=' + allowNextNavigation);

      if (allowNextNavigation) {
        allowNextNavigation = false;
        snapshot('programmatic nav');
        return Promise.resolve(event);
      }

      if (d.sourcePage === 1) {
        say('PREVENTING page 1 exit');
        event.preventDefault();
        runValidationChain();
        return Promise.resolve(event);
      }

      snapshot('nav from page ' + d.sourcePage);
      return Promise.resolve(event);
    }
  });

  say('=== script loaded ===');
  snapshot('initial load');
})();
