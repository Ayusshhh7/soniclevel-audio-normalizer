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

## 🚀 How to Install & Test

1. Open Google Chrome, Brave, or Microsoft Edge.
2. Navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select this folder:
   ```
   c:\Users\HP\OneDrive\Apps\sum-ext
   ```
6. The **SonicLevel** icon will appear in your browser extension toolbar! Pin it for easy access.

---

---

## 📦 How to Publish & Make It Available for Everyone

### Option 1: Chrome Web Store (Recommended)
1. Generate the distribution ZIP archive:
   ```bash
   node package.js
   ```
   This generates `dist/soniclevel-v1.0.0.zip`.
2. Go to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
3. Sign in and pay the one-time \$5 developer registration fee.
4. Click **Add new item** and upload `dist/soniclevel-v1.0.0.zip`.
5. Fill in the **Privacy & Permissions** tab with these exact details:
   - **Single Purpose:** *Enhance and normalize web audio output across video and audio streaming sites.*
   - **Permission Justification (`<all_urls>`):** *Required to attach Web Audio nodes to HTML5 audio/video elements across media platforms.*
   - **Permission Justification (`storage`):** *Used strictly to save user EQ presets and domain preferences locally.*
   - **Data Collection:** Check *No user data collected*.
6. Click **Submit for Review** (approval takes 1–3 days).

### Option 2: Microsoft Edge Add-ons (Free)
1. Go to the [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge).
2. Registration is **100% free**.
3. Upload the exact same `dist/soniclevel-v1.0.0.zip`.

### Option 3: GitHub Releases (Instant & Free)
1. Push this project to a GitHub repository.
2. Go to **Releases** → **Create a new release** and attach `dist/soniclevel-v1.0.0.zip`.
3. Anyone can download it, unzip, and load it into Chrome via `chrome://extensions/` with Developer Mode enabled.


A built-in interactive test harness is included:
1. In your browser, open `test-lab.html` directly (or press `Ctrl + O` and browse to `test-lab.html`).
2. Test Case 1 lets you simulate a quiet whisper followed by an ear-piercing commercial.
3. Open the SonicLevel extension popup:
   - Toggle **Smart Normalizer: Night Mode** to hear how it immediately clamps the loud spike.
   - Adjust the **4 kHz** slider to hear the vocal frequencies jump forward.
   - Boost the **Master Gain to 200%** to hear quiet speech amplified.
