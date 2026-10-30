// SonicLevel Audio Processor (Runs in page context / MAIN world)
(() => {
  if (window.__SONIC_LEVEL_INITIALIZED__) return;
  window.__SONIC_LEVEL_INITIALIZED__ = true;

  // Audio Processing State
  const state = {
    enabled: true,
    normalizerEnabled: true,
    normalizerPreset: 'balanced', // subtle, balanced, aggressive (night mode)
    masterVolume: 1.0, // 0.0 to 4.0 (up to 400%)
    eqGains: [0, 0, 0, 0, 0], // dB for 60Hz, 250Hz, 1kHz, 4kHz, 12kHz
  };

  const NORMALIZER_PROFILES = {
    subtle: {
      threshold: -18, // dB
      knee: 15,
      ratio: 4,
      attack: 0.005, // 5ms
      release: 0.25  // 250ms
    },
    balanced: {
      threshold: -28, // dB
      knee: 20,
      ratio: 8,
      attack: 0.003, // 3ms (fast catch for sudden ads)
      release: 0.20
    },
    aggressive: { // Night Mode / Loud Ad & Explosion Tamer
      threshold: -38, // dB (heavily compresses loud sounds, lifts whispers)
      knee: 25,
      ratio: 16,
      attack: 0.001, // 1ms
      release: 0.15
    }
  };

  const EQ_FREQUENCIES = [60, 250, 1000, 4000, 12000];
  const EQ_TYPES = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

  // Global AudioContext and attached media map
  let audioCtx = null;
  const attachedMedia = new WeakMap(); // mediaElement -> { source, nodes, chain }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      const resume = () => {
        audioCtx.resume();
        window.removeEventListener('click', resume, true);
        window.removeEventListener('keydown', resume, true);
      };
      window.addEventListener('click', resume, true);
      window.addEventListener('keydown', resume, true);
    }
    return audioCtx;
  }

  // Build audio pipeline for a single HTMLMediaElement (<video> or <audio>)
  function attachToMedia(el) {
    if (attachedMedia.has(el)) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      // Connect to element
      const source = ctx.createMediaElementSource(el);
      
      // 1. Pre-Gain Node (Master Booster)
      const gainNode = ctx.createGain();
      gainNode.gain.value = state.enabled ? state.masterVolume : 1.0;

      // 2. 5-Band EQ (BiquadFilterNodes)
      const eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = EQ_TYPES[idx];
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = state.enabled ? state.eqGains[idx] : 0;
        return filter;
      });

      // 3. Dynamic Compressor (Volume Normalizer & Ad/Spike Tamer)
      const compressor = ctx.createDynamicsCompressor();
      applyCompressorProfile(compressor, state.normalizerPreset, state.enabled && state.normalizerEnabled);

      // 4. Analyser Node (for real-time VU meter feedback)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      // 5. Final Safety Limiter Node
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -0.5; // Catch any digital clipping
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;

      // Chain connections:
      // source -> gainNode -> eq[0] -> ... -> eq[4] -> compressor -> analyser -> limiter -> destination
      source.connect(gainNode);
      let lastNode = gainNode;
      for (const filter of eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }
      lastNode.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(limiter);
      limiter.connect(ctx.destination);

      attachedMedia.set(el, {
        source,
        gainNode,
        eqFilters,
        compressor,
        analyser,
        limiter
      });

      // Resume context when playback starts
      el.addEventListener('play', () => {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      });
    } catch (err) {
      // Media may be cross-origin without CORS or already connected by page script
      console.debug('[SonicLevel] Audio graph attach skipped/handled:', err.message);
    }
  }

  function applyCompressorProfile(compressor, presetKey, isEnabled) {
    if (!compressor) return;
    const profile = NORMALIZER_PROFILES[presetKey] || NORMALIZER_PROFILES.balanced;
    const now = audioCtx ? audioCtx.currentTime : 0;

    if (!isEnabled) {
      // Bypass compression
      compressor.threshold.setValueAtTime(0, now);
      compressor.ratio.setValueAtTime(1, now);
      return;
    }

    compressor.threshold.setValueAtTime(profile.threshold, now);
    compressor.knee.setValueAtTime(profile.knee, now);
    compressor.ratio.setValueAtTime(profile.ratio, now);
    compressor.attack.setValueAtTime(profile.attack, now);
    compressor.release.setValueAtTime(profile.release, now);
  }

  // Update existing audio chains with latest state
  function updateAllNodes() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const mediaList = document.querySelectorAll('video, audio');
    mediaList.forEach(el => {
      const bundle = attachedMedia.get(el);
      if (!bundle) {
        attachToMedia(el);
        return;
      }

      const isEffectActive = state.enabled;

      // Update Gain
      const targetGain = isEffectActive ? state.masterVolume : 1.0;
      bundle.gainNode.gain.cancelScheduledValues(now);
      bundle.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.05);

      // Update EQ Filters
      bundle.eqFilters.forEach((filter, idx) => {
        const targetDb = isEffectActive ? (state.eqGains[idx] || 0) : 0;
        filter.gain.cancelScheduledValues(now);
        filter.gain.linearRampToValueAtTime(targetDb, now + 0.05);
      });

      // Update Compressor
      applyCompressorProfile(
        bundle.compressor,
        state.normalizerPreset,
        isEffectActive && state.normalizerEnabled
      );
    });
  }

  // Scan and attach to all media elements in DOM
  function scanMedia() {
    const elements = document.querySelectorAll('video, audio');
    elements.forEach(attachToMedia);
  }

  // Watch for dynamic video/audio additions (e.g. YouTube navigation, modals, ads)
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) { // ELEMENT_NODE
          if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
            attachToMedia(node);
          } else if (node.querySelectorAll) {
            const nested = node.querySelectorAll('video, audio');
            nested.forEach(attachToMedia);
          }
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Initial scan
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanMedia);
  } else {
    scanMedia();
  }

  // Real-time audio VU level reader
  function getLiveAudioLevel() {
    let maxRms = 0;
    const elements = document.querySelectorAll('video, audio');
    elements.forEach(el => {
      if (!el.paused && !el.ended && el.readyState > 2) {
        const bundle = attachedMedia.get(el);
        if (bundle && bundle.analyser) {
          const buffer = new Uint8Array(bundle.analyser.frequencyBinCount);
          bundle.analyser.getByteTimeDomainData(buffer);
          let sumSquares = 0;
          for (let i = 0; i < buffer.length; i++) {
            const norm = (buffer[i] - 128) / 128;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / buffer.length);
          if (rms > maxRms) maxRms = rms;
        }
      }
    });
    return Math.min(1.0, maxRms * 2.5); // Scaled for UI meter
  }

  // Message listener from content script
  window.addEventListener('message', event => {
    if (event.source !== window || !event.data || event.data.source !== 'SONIC_LEVEL_CONTENT') {
      return;
    }

    const { type, payload } = event.data;

    if (type === 'SET_STATE') {
      Object.assign(state, payload);
      updateAllNodes();
      window.postMessage({
        source: 'SONIC_LEVEL_PROCESSOR',
        type: 'STATE_UPDATED',
        payload: state
      }, '*');
    } else if (type === 'GET_STATE') {
      window.postMessage({
        source: 'SONIC_LEVEL_PROCESSOR',
        type: 'STATE_RESPONSE',
        payload: {
          ...state,
          audioLevel: getLiveAudioLevel()
        }
      }, '*');
    }
  });

  // Periodically emit audio levels if media is actively playing
  setInterval(() => {
    const level = getLiveAudioLevel();
    if (level > 0.02) {
      window.postMessage({
        source: 'SONIC_LEVEL_PROCESSOR',
        type: 'AUDIO_LEVEL',
        level: level
      }, '*');
    }
  }, 100);
})();
