# 🎚️ SonicLevel — Smart Web Audio Normalizer & Equalizer

A Chrome extension (Manifest V3) that levels volume spikes, tames loud commercials, boosts whisper-quiet dialogue, and offers a real-time 5-band studio equalizer with up to 400% volume boosting.

---

## ⚡ Core Features

- **🛡️ Smart Volume Normalizer (Dynamic Range Compressor):**
  - Catches sudden high-decibel volume spikes (loud YouTube ads, movie explosions).
  - Automatically brings up quiet dialogue without distorting overall sound.
  - 3 tuning modes: **Subtle**, **Balanced**, and **Night Mode (Aggressive Limiting)**.
- **🔊 Master Gain & Volume Booster:**
  - Boost quiet lectures, indie podcasts, and low-gain laptop speakers up to **400% (+12 dB)**.
  - Built-in lookahead soft-limiter prevents digital clipping and speaker crackle.
- **🎛️ 5-Band Studio Equalizer:**
  - Multi-band parametric EQ: **60 Hz** (Sub-bass), **250 Hz** (Low Warmth), **1 kHz** (Mids), **4 kHz** (Speech Presence), **12 kHz** (Treble/Air).
  - Presets: *Flat*, *Vocal / Lecture Boost*, *Bass Booster*, *Movie Anti-Boom*, *Treble & Clarity*.
- **📊 Real-time VU Level Meter:**
  - Live audio activity and dB reading driven directly by `AnalyserNode`.
- **🌐 Per-Site Memory:**
  - Automatically remembers your audio preferences per website (e.g., `youtube.com`, `coursera.org`, `netflix.com`).

---

## 🏗️ Technical Architecture & Signal Pipeline

```
[ HTML5 <video> / <audio> Element ]
                │
                ▼
      [ createMediaElementSource ]
                │
                ▼
       [ Master Gain Booster ]  (0% – 400%)
                │
                ▼
      [ 5-Band Biquad Filters ] (60Hz, 250Hz, 1kHz, 4kHz, 12kHz)
                │
                ▼
  [ DynamicsCompressorNode (Normalizer) ] (Threshold, Knee, Ratio, Attack, Release)
                │
                ▼
         [ AnalyserNode ] ───► (Live VU meter feedback to Popup)
                │
                ▼
      [ Safety Brickwall Limiter ] (-0.5 dB Anti-Clipping)
                │
                ▼
      [ AudioContext.destination ] (Speakers / Headphones)
```

### Manifest V3 Implementation Highlights
- **Dual-World Script Bridge:** Uses a lightweight isolated-world content script (`content.js`) for `chrome.storage` and `chrome.runtime` APIs, and injects the Web Audio processor (`audio-processor.js`) into the webpage's **MAIN world** to hook into page media elements directly without cross-world origin friction.
- **Dynamic Element Tracking:** Employs a `MutationObserver` to immediately attach audio nodes to dynamic video tags (such as when YouTube navigates between videos without full page reloads).
- **Autoplay Policy Handling:** Automatically unlocks and resumes `AudioContext` upon user interaction or media playback.

---

