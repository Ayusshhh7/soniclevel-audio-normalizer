// SonicLevel Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SonicLevel] Extension installed/updated.');
  
  // Set default global configuration if not present
  chrome.storage.local.get(['globalSettings'], res => {
    if (!res.globalSettings) {
      chrome.storage.local.set({
        globalSettings: {
          enabled: true,
          normalizerEnabled: true,
          normalizerPreset: 'balanced',
          masterVolume: 1.0,
          eqGains: [0, 0, 0, 0, 0],
          perSite: true
        }
      });
    }
  });
});

// Update extension icon badge depending on enabled status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPDATE_BADGE') {
    const text = message.enabled ? 'ON' : '';
    const color = message.normalizerEnabled ? '#10b981' : '#6366f1'; // emerald green or indigo
    chrome.action.setBadgeText({ text: text, tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: color, tabId: sender.tab?.id });
  }
});
