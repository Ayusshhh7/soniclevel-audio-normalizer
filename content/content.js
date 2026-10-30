// SonicLevel Content Script (Isolated World)
(() => {
  const SCRIPT_ID = 'soniclevel-audio-processor-script';

  // Inject audio-processor.js into page MAIN world
  function injectProcessor() {
    if (document.getElementById(SCRIPT_ID)) return;
    try {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = chrome.runtime.getURL('content/audio-processor.js');
      script.onload = () => {
        script.remove();
        syncInitialSettings();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (err) {
      console.warn('[SonicLevel] Injection error:', err);
    }
  }

  const hostname = window.location.hostname || 'default';

  // Fetch saved settings for this site from storage and send to page processor
  function syncInitialSettings() {
    chrome.storage.local.get([hostname, 'globalSettings'], res => {
      const siteSettings = res[hostname];
      const globalDefaults = res.globalSettings || {
        enabled: true,
        normalizerEnabled: true,
        normalizerPreset: 'balanced',
        masterVolume: 1.0,
        eqGains: [0, 0, 0, 0, 0],
        perSite: true
      };

      const settingsToApply = siteSettings || globalDefaults;
      sendToProcessor('SET_STATE', settingsToApply);
    });
  }

  function sendToProcessor(type, payload) {
    window.postMessage({
      source: 'SONIC_LEVEL_CONTENT',
      type: type,
      payload: payload
    }, '*');
  }

  // Handle messages from the extension popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_TAB_STATE') {
      let responded = false;

      const responseHandler = (event) => {
        if (event.source === window && event.data && event.data.source === 'SONIC_LEVEL_PROCESSOR' && event.data.type === 'STATE_RESPONSE') {
          window.removeEventListener('message', responseHandler);
          if (!responded) {
            responded = true;
            sendResponse({
              hostname: hostname,
              state: event.data.payload
            });
          }
        }
      };

      window.addEventListener('message', responseHandler);
      sendToProcessor('GET_STATE');

      // Fallback timeout in case page has no media or script hasn't fired
      setTimeout(() => {
        if (!responded) {
          responded = true;
          window.removeEventListener('message', responseHandler);
          chrome.storage.local.get([hostname, 'globalSettings'], res => {
            sendResponse({
              hostname: hostname,
              state: res[hostname] || res.globalSettings || {
                enabled: true,
                normalizerEnabled: true,
                normalizerPreset: 'balanced',
                masterVolume: 1.0,
                eqGains: [0, 0, 0, 0, 0],
                audioLevel: 0
              }
            });
          });
        }
      }, 150);

      return true; // Keep message channel open for async response
    }

    if (message.action === 'UPDATE_SETTINGS') {
      sendToProcessor('SET_STATE', message.payload);

      // Save to chrome storage
      if (message.saveAsSiteDefault) {
        chrome.storage.local.set({ [hostname]: message.payload });
      } else {
        chrome.storage.local.set({ globalSettings: message.payload });
      }

      sendResponse({ success: true });
      return true;
    }
  });

  // Relay live audio level from MAIN world to runtime (popup) if requested
  window.addEventListener('message', event => {
    if (event.source !== window || !event.data || event.data.source !== 'SONIC_LEVEL_PROCESSOR') {
      return;
    }

    if (event.data.type === 'AUDIO_LEVEL') {
      chrome.runtime.sendMessage({
        action: 'AUDIO_LEVEL_TICK',
        level: event.data.level
      }).catch(() => {
        // Popup may be closed, ignore
      });
    }
  });

  injectProcessor();
})();
