/*
 * PlotReg V23 cross-origin RPC transport.
 * The UI runs entirely on the GitHub Pages PWA origin. API requests are POSTed
 * through a hidden iframe/form to the existing Apps Script /exec endpoint.
 * doPost() returns the response with postMessage restricted to the configured
 * PWA origin. No registration UI is embedded in the iframe.
 */
(function () {
  'use strict';
  var execUrl = String(window.PLOT_REGISTRATION_APP_URL || '').trim();
  var pending = Object.create(null);
  var sequence = 0;
  var allowedMethods = {
    getAppInfo: true, login: true, logout: true, changePassword: true,
    createEmployee: true, getEmployees: true, setEmployeeActive: true,
    resetEmployeePassword: true, fetchRegistrationDashboardV3: true,
    getRegistrationForEditV4: true, saveRegistration: true,
    uploadFile: true, getUploadHistory: true, diagnoseApp: true
  };

  function validExecUrl(value) {
    try {
      var u = new URL(value);
      return u.protocol === 'https:' && /(^|\.)script\.google\.com$/i.test(u.hostname) && /\/macros\/s\/[^/]+\/exec$/.test(u.pathname);
    } catch (e) { return false; }
  }

  function cleanup(id) {
    var item = pending[id];
    if (!item) return;
    window.clearTimeout(item.timer);
    try { item.form.remove(); } catch (e) {}
    try { item.frame.remove(); } catch (e) {}
    delete pending[id];
  }

  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || message.type !== 'PLOTREG_RPC_RESULT' || !message.requestId) return;
    var item = pending[String(message.requestId)];
    if (!item || event.source !== item.frame.contentWindow) return;
    var host = '';
    try { host = new URL(event.origin).hostname.toLowerCase(); } catch (e) { return; }
    if (event.origin !== 'null' && host !== 'script.google.com' && host !== 'googleusercontent.com' && !host.endsWith('.googleusercontent.com')) return;
    cleanup(String(message.requestId));
    if (message.ok) {
      if (typeof item.success === 'function') item.success(message.result);
    } else {
      var error = { message: String(message.message || 'The registration server rejected the request.') };
      if (typeof item.failure === 'function') item.failure(error);
      else console.error('PlotReg request failed:', error.message);
    }
  });

  function rpc(method, args, success, failure) {
    if (!validExecUrl(execUrl) || execUrl.indexOf('PASTE_YOUR_') !== -1) {
      var configError = { message: 'Configure the existing Apps Script /exec URL in config.js, then publish the PWA again.' };
      if (typeof failure === 'function') failure(configError); else console.error(configError.message);
      return;
    }
    if (!allowedMethods[method]) {
      var methodError = { message: 'Unsupported application operation: ' + method };
      if (typeof failure === 'function') failure(methodError); else console.error(methodError.message);
      return;
    }

    var id = 'rpc_' + Date.now() + '_' + (++sequence) + '_' + Math.random().toString(36).slice(2, 9);
    var frame = document.createElement('iframe');
    frame.name = 'plotreg_transport_' + id;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;border:0;';

    var form = document.createElement('form');
    form.method = 'POST';
    form.action = execUrl;
    form.target = frame.name;
    form.acceptCharset = 'UTF-8';
    form.style.display = 'none';
    var payload = {
      requestId: id,
      method: method,
      args: Array.isArray(args) ? args : []
    };
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    pending[id] = {
      frame: frame,
      form: form,
      success: success,
      failure: failure,
      timer: window.setTimeout(function () {
        cleanup(id);
        if (typeof failure === 'function') failure({ message: 'The server did not respond within 3 minutes. Check your connection and try again.' });
      }, 180000)
    };
    document.body.appendChild(frame);
    document.body.appendChild(form);
    try { form.submit(); }
    catch (e) {
      cleanup(id);
      if (typeof failure === 'function') failure({ message: e && e.message ? e.message : 'Could not send the request to Apps Script.' });
    }
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: false,
    enumerable: true,
    get: function () {
      var onSuccess = null;
      var onFailure = null;
      var chain = {
        withSuccessHandler: function (fn) { onSuccess = fn; return chain; },
        withFailureHandler: function (fn) { onFailure = fn; return chain; }
      };
      return new Proxy(chain, {
        get: function (target, property) {
          if (property in target) return target[property];
          if (typeof property !== 'string') return undefined;
          return function () { rpc(property, Array.prototype.slice.call(arguments), onSuccess, onFailure); };
        }
      });
    }
  });
  window.PLOTREG_TRANSPORT_READY = true;
})();
