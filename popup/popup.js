// SonicLevel Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const siteDomainEl = document.getElementById('siteDomain');
  const masterToggle = document.getElementById('masterToggle');
  const mainControls = document.getElementById('mainControls');
  const vuMeterFill = document.getElementById('vuMeterFill');
  const meterDbText = document.getElementById('meterDbText');

  const normalizerToggle = document.getElementById('normalizerToggle');
  const normalizerIndicator = document.getElementById('normalizerIndicator');
  const normalizerPresets = document.getElementById('normalizerPresets');
  
  const masterVolumeSlider = document.getElementById('masterVolumeSlider');
  const gainValueText = document.getElementById('gainValueText');
  const quickGainBtns = document.querySelectorAll('.quick-btn');

  const eqPresetSelect = document.getElementById('eqPresetSelect');
  const eqSliders = document.querySelectorAll('.eq-slider');
  const resetEqBtn = document.getElementById('resetEqBtn');
  const perSiteCheckbox = document.getElementById('perSiteCheckbox');
  const resetAllBtn = document.getElementById('resetAllBtn');

  // EQ Presets definition in dB [60Hz, 250Hz, 1kHz, 4kHz, 12kHz]
  const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0],
    vocal: [-2, 1, 4, 5, 2],       // Boost speech intelligibility, suppress boom
    bass: [6, 4, 1, 0, 0],         // Punchy low end
    night: [-6, -3, 3, 4, 1],      // Suppress sub-bass rumbles/explosions, highlight dialogue
    treble: [-1, 0, 1, 4, 6]       // Crisp highs
  };

  // State object
  let currentState = {
    enabled: true,
    normalizerEnabled: true,
    normalizerPreset: 'balanced',
    masterVolume: 1.0,
    eqGains: [0, 0, 0, 0, 0],
    perSite: true
  };

  let activeTabId = null;
  let activeHostname = 'Global';

  // 1. Identify active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTabId = tab.id;
      try {
        const urlObj = new URL(tab.url);
        if (urlObj.protocol.startsWith('http')) {
          activeHostname = urlObj.hostname;
        } else {
          activeHostname = 'Special Page';
        }
      } catch {
        activeHostname = 'Current Tab';
      }
    }
  } catch (err) {
    console.warn('Could not query active tab:', err);
  }

  siteDomainEl.textContent = activeHostname;

  // 2. Load tab state
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { action: 'GET_TAB_STATE' }, response => {
      if (chrome.runtime.lastError || !response) {
        // Tab has no content script yet or is a chrome:// page, load from storage
        loadFromStorage();
      } else {
        if (response.state) {
          currentState = { ...currentState, ...response.state };
          renderUI();
        }
      }
    });
  } else {
    loadFromStorage();
  }

  function loadFromStorage() {
    chrome.storage.local.get([activeHostname, 'globalSettings'], res => {
      const saved = res[activeHostname] || res.globalSettings;
      if (saved) {
        currentState = { ...currentState, ...saved };
      }
      renderUI();
    });
  }

  // 3. Render state to UI
  function renderUI() {
    // Master Power
    masterToggle.checked = currentState.enabled;
    if (currentState.enabled) {
      mainControls.classList.remove('disabled-mode');
    } else {
      mainControls.classList.add('disabled-mode');
    }

    // Normalizer
    normalizerToggle.checked = currentState.normalizerEnabled;
    normalizerIndicator.classList.toggle('active', currentState.enabled && currentState.normalizerEnabled);
    
    // Normalizer Presets
    normalizerPresets.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === currentState.normalizerPreset);
    });

    // Master Volume
    const percent = Math.round(currentState.masterVolume * 100);
    masterVolumeSlider.value = percent;
    gainValueText.textContent = `${percent}%`;
    quickGainBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.gain, 10) === percent);
    });

    // Equalizer Sliders
    eqSliders.forEach((slider, idx) => {
      const val = currentState.eqGains[idx] || 0;
      slider.value = val;
      const valDisplay = document.getElementById(`eqVal${idx}`);
      if (valDisplay) {
        valDisplay.textContent = (val > 0 ? `+${val}` : `${val}`) + 'dB';
      }
    });

    // Detect EQ preset match
    matchEqPresetDropdown();
  }

  function matchEqPresetDropdown() {
    let matched = 'custom';
    for (const [key, gains] of Object.entries(EQ_PRESETS)) {
      if (gains.every((g, i) => g === (currentState.eqGains[i] || 0))) {
        matched = key;
        break;
      }
    }
    if (matched !== 'custom') {
      eqPresetSelect.value = matched;
    } else {
      // If none match, keep current or add a custom indicator
      if (!Array.from(eqPresetSelect.options).some(o => o.value === 'custom')) {
        const opt = document.createElement('option');
        opt.value = 'custom';
        opt.textContent = 'Custom EQ';
        eqPresetSelect.appendChild(opt);
      }
      eqPresetSelect.value = 'custom';
    }
  }

  // 4. Dispatch updates to active tab & storage
  function applyState() {
    renderUI();

    const payload = {
      enabled: currentState.enabled,
      normalizerEnabled: currentState.normalizerEnabled,
      normalizerPreset: currentState.normalizerPreset,
      masterVolume: currentState.masterVolume,
      eqGains: currentState.eqGains,
      perSite: perSiteCheckbox.checked
    };

    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, {
        action: 'UPDATE_SETTINGS',
        payload: payload,
        saveAsSiteDefault: perSiteCheckbox.checked
      }, () => {
        if (chrome.runtime.lastError) {
          // Tab not scriptable
        }
      });
    }

    // Save directly to storage
    if (perSiteCheckbox.checked && activeHostname.includes('.')) {
      chrome.storage.local.set({ [activeHostname]: payload });
    } else {
      chrome.storage.local.set({ globalSettings: payload });
    }

    // Update badge in background
    chrome.runtime.sendMessage({
      action: 'UPDATE_BADGE',
      enabled: currentState.enabled,
      normalizerEnabled: currentState.normalizerEnabled
    }).catch(() => {});
  }

  // 5. Event Listeners
  masterToggle.addEventListener('change', () => {
    currentState.enabled = masterToggle.checked;
    applyState();
  });

  normalizerToggle.addEventListener('change', () => {
    currentState.normalizerEnabled = normalizerToggle.checked;
    applyState();
  });

  normalizerPresets.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    currentState.normalizerPreset = btn.dataset.preset;
    applyState();
  });

  masterVolumeSlider.addEventListener('input', () => {
    const percent = parseInt(masterVolumeSlider.value, 10);
    currentState.masterVolume = percent / 100;
    gainValueText.textContent = `${percent}%`;
    quickGainBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.gain, 10) === percent);
    });
    applyState();
  });

  quickGainBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const percent = parseInt(btn.dataset.gain, 10);
      currentState.masterVolume = percent / 100;
      masterVolumeSlider.value = percent;
      applyState();
    });
  });

  eqSliders.forEach(slider => {
    slider.addEventListener('input', () => {
      const bandIdx = parseInt(slider.dataset.band, 10);
      const val = parseInt(slider.value, 10);
      currentState.eqGains[bandIdx] = val;
      const valDisplay = document.getElementById(`eqVal${bandIdx}`);
      if (valDisplay) {
        valDisplay.textContent = (val > 0 ? `+${val}` : `${val}`) + 'dB';
      }
      matchEqPresetDropdown();
      applyState();
    });
  });

  eqPresetSelect.addEventListener('change', () => {
    const selected = eqPresetSelect.value;
    if (EQ_PRESETS[selected]) {
      currentState.eqGains = [...EQ_PRESETS[selected]];
      applyState();
    }
  });

  resetEqBtn.addEventListener('click', () => {
    currentState.eqGains = [0, 0, 0, 0, 0];
    eqPresetSelect.value = 'flat';
    applyState();
  });

  resetAllBtn.addEventListener('click', () => {
    currentState = {
      enabled: true,
      normalizerEnabled: true,
      normalizerPreset: 'balanced',
      masterVolume: 1.0,
      eqGains: [0, 0, 0, 0, 0],
      perSite: true
    };
    applyState();
  });

  // 6. Live VU Meter Visualizer
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'AUDIO_LEVEL_TICK') {
      const level = Math.min(1.0, Math.max(0, msg.level));
      const widthPct = Math.round(level * 100);
      vuMeterFill.style.width = `${widthPct}%`;

      if (level > 0.05) {
        const approxDb = Math.round(20 * Math.log10(level));
        meterDbText.textContent = `${approxDb} dB`;
      } else {
        meterDbText.textContent = '-∞ dB';
      }
    }
  });
});
