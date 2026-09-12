#ifndef POLYFILLS_HPP
#define POLYFILLS_HPP

#include <string>

// JavaScript polyfills injected into Webview before document loading
const std::string POLYFILLS_JS = R"rawliteral(
(function() {
  window.DESKTOP_ENV = true;
  window.DESKTOP_CPP = true;
  window.chrome = window.chrome || {};
  window.chrome.storage = window.chrome.storage || {};

  if (!window.chrome.storage.local) {
    window.chrome.storage.local = {
      get: function(keys, callback) {
        return new Promise(function(resolve) {
          var res = {};
          try {
            if (!keys) {
              for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                try {
                  res[k] = JSON.parse(localStorage.getItem(k));
                } catch(e) {
                  res[k] = localStorage.getItem(k);
                }
              }
            } else if (typeof keys === 'string') {
              var val = localStorage.getItem(keys);
              if (val !== null) {
                try { res[keys] = JSON.parse(val); } catch(e) { res[keys] = val; }
              }
            } else if (Array.isArray(keys)) {
              keys.forEach(function(k) {
                var val = localStorage.getItem(k);
                if (val !== null) {
                  try { res[k] = JSON.parse(val); } catch(e) { res[k] = val; }
                }
              });
            } else if (typeof keys === 'object') {
              for (var k in keys) {
                var val = localStorage.getItem(k);
                if (val !== null) {
                  try { res[k] = JSON.parse(val); } catch(e) { res[k] = val; }
                } else {
                  res[k] = keys[k];
                }
              }
            }
          } catch (err) {
            console.error('[Storage Polyfill] Get error:', err);
          }

          if (typeof callback === 'function') {
            try { callback(res); } catch (cbErr) { console.error(cbErr); }
          }
          resolve(res);
        });
      },

      set: function(items, callback) {
        return new Promise(function(resolve) {
          try {
            for (var k in items) {
              var val = items[k];
              if (typeof val === 'object') {
                localStorage.setItem(k, JSON.stringify(val));
              } else {
                localStorage.setItem(k, val);
              }
            }
          } catch (err) {
            console.error('[Storage Polyfill] Set error:', err);
          }

          if (typeof callback === 'function') {
            try { callback(); } catch (cbErr) { console.error(cbErr); }
          }
          resolve();
        });
      },

      remove: function(keys, callback) {
        return new Promise(function(resolve) {
          try {
            var arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(function(k) { localStorage.removeItem(k); });
          } catch (err) {
            console.error('[Storage Polyfill] Remove error:', err);
          }

          if (typeof callback === 'function') {
            try { callback(); } catch (cbErr) { console.error(cbErr); }
          }
          resolve();
        });
      },

      clear: function(callback) {
        return new Promise(function(resolve) {
          try {
            localStorage.clear();
          } catch (err) {
            console.error('[Storage Polyfill] Clear error:', err);
          }

          if (typeof callback === 'function') {
            try { callback(); } catch (cbErr) { console.error(cbErr); }
          }
          resolve();
        });
      }
    };
  }

  // Prevent backspace navigating back outside input elements
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace') {
      var tag = (e.target.tagName || '').toLowerCase();
      var isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (!isInput) {
        e.preventDefault();
      }
    }
  });
})();
)rawliteral";

#endif // POLYFILLS_HPP

