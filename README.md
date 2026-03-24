<div align="center">

# ⚡ Signal Equalizer

**Real-time signal processing and analysis across 5 specialized modes**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

![Landing Page](screenshots/landing_page.png)

*Pick a mode. Load a signal. See everything — instantly.*

---

## What is this?

Signal Equalizer is a full-stack signal processing workbench. You load an audio file (or generate a synthetic one), choose a processing mode, and the app gives you:

- Side-by-side **input vs output waveform** viewers
- **FFT spectrum** comparison in real time
- **Wavelet decomposition** with selectable basis functions
- **Spectrogram** heatmaps for time-frequency analysis
- **AI-powered separation** for music, voices, and ECG diagnostics

Every slider interaction immediately re-processes the signal through the backend and updates all charts live.

---

## Five Modes

### ⟟ Generic Mode
> Build your own equalizer with fully custom frequency bands.

![Generic Mode](screenshots/generic_mode.png)

Add as many bands as you need, set the Hz range for each, and control gain from 0× (silent) to 2× (doubled). Drag sliders on the equalizer curve to see which frequencies you're targeting. Useful for any audio signal where you want precise, custom frequency control.

---

### ♫ Musical Instruments
> Balance the individual stems of a music mix.

![Music Mode](screenshots/music_mode.png)

Six bands map directly to the natural frequency range of each instrument family — **Drums**, **Bass**, **Vocals**, **Guitar**, **Piano**, and **Other**. Boost or mute any source component in the mix using both FFT and wavelet processing paths.

---

### ❖ Animal Sounds
> Separate animal vocalizations by species-accurate frequency ranges.

![Animal Mode](screenshots/animal_mode.png)

| Group | Frequency Range |
|-------|----------------|
| Songbirds | 1,000 – 8,000 Hz |
| Canines | 150 – 2,000 Hz |
| Felines | 48 – 10,000 Hz |
| Large Mammals | 5 – 500 Hz |
| Insects | 600 – 20,000 Hz |

---

### ⌁ Human Voices
> Distinguish overlapping speakers by fundamental frequency range.

![Human Mode](screenshots/human_mode.png)

| Voice Type | Range |
|-----------|-------|
| Male | 85 – 180 Hz |
| Female | 165 – 300 Hz |
| Old | 80 – 150 Hz |
| Child | 220 – 420 Hz |

---

### ♡ ECG Abnormalities
> Process cardiac signals and isolate arrhythmia components.

![ECG Mode](screenshots/ecg_mode.png)

Operates at 500 Hz (cardiac, not audio). Each band targets a specific heart rhythm component:

| Component | Range | Meaning |
|-----------|-------|---------|
| Normal | 2.2 – 15.5 Hz | Regular heartbeat |
| AFib | 0 – 179.4 Hz | Atrial fibrillation |
| VTach | 2.2 – 3.3 Hz | Ventricular tachycardia |
| HeartBlock | 2.2 – 31.0 Hz | Conduction delay |

---

## Signal Analysis Features

### 📊 FFT Spectrum (Input vs Output)

Every mode shows the frequency spectrum of both the input and processed output — live, side by side. You can immediately see how your equalization affects the signal in the frequency domain. Toggle **Audiogram scale** to switch between linear and logarithmic display.

![FFT Comparison](screenshots/fft_comparison.png)

---

### 🎨 Spectrogram (Time-Frequency Heatmap)

Click **Show spectrograms** to reveal STFT-based time-frequency heatmaps for both input and output. Multiple color scales are available — **Inferno**, **Viridis**, **Plasma**, and more. Spectrograms make it easy to spot bursts, sustained tones, and temporal changes in the signal.

![Spectrogram View](screenshots/spectrogram_view.png)

---

### 🌊 Wavelet Processing

Switch from FFT to **Wavelet mode** using the toggle in the Equalizer Controls panel. This changes the processing pipeline from frequency-domain to multi-scale wavelet decomposition.

![Wavelet Sliders](screenshots/wavelet_sliders.png)

In wavelet mode you get:

- **Per-level gain sliders** (L1–Ln) — each level corresponds to a different frequency scale
- **Wavelet basis selector** — 9 options, each with a different time-frequency trade-off:

| Basis | Code | Best suited for |
|-------|------|----------------|
| Haar | `haar` | Sharp transients, quick decomposition |
| Daubechies 4 | `db4` | General purpose (Generic mode default) |
| Daubechies 6 | `db6` | Smoother than db4, more overlap |
| Daubechies 8 | `db8` | Harmonic-rich audio (Music default) |
| Symlet 5 | `sym5` | Near-symmetric, speech (Human default) |
| Symlet 8 | `sym8` | Bioacoustic textures (Animal default) |
| Coiflet 3 | `coif3` | Symmetric, good reconstruction |
| Biorthogonal 3.5 | `bior3.5` | ECG-friendly (ECG default) |
| Discrete Meyer | `dmey` | Smooth frequency localization |

The maximum decomposition level is automatically calculated from the signal length and wavelet filter size.

---

### 🤖 AI Separation

Every applicable mode has an **AI Separation** tab alongside the main Equalizer view.

![AI Separation](screenshots/ai_separation.png)

| Mode | AI Model | Output |
|------|----------|--------|
| **Music** | Demucs (htdemucs_6s) | 6 downloadable WAV stems |
| **Human Voices** | SpeechBrain SepFormer | 2 speaker stems |
| **ECG** | ResNet + GradCAM | Arrhythmia probabilities + explainability heatmap |

Downloadable stems allow you to compare AI-separated sources directly against the DSP band-filtered results.

---

### 🔊 Mode Selector

Switch between all five modes at any time without losing work — each mode has completely isolated state.

![Mode Selector](screenshots/mode_selector.png)

---

## Other Features

**Audio Transport Controls** — Each signal viewer has independent playback with play, pause, stop, rate (0.5× · 1× · 1.5× · 2×), and volume.

**Signal Management** — Upload your own WAV files or use built-in synthetic sample generators (one per mode). Uploaded signals are stored per mode and can be listed, reloaded, or deleted.

**Save & Load Settings** — Export your equalizer configuration as JSON (bands, gains, wavelet basis, wavelet level). Load it back later. Preset schemas for the frontend layout can be saved and restored separately.

**Export** — Download the processed output signal as a WAV file.

---

## 🎬 Video Demo

> End-to-end walkthrough — landing page → mode selection → signal loading → live visualization

![Overview Demo](screenshots/videos/overview_demo.webp)

---

## 🔌 API Reference

All endpoints at `http://localhost:8000` | Interactive docs at [`/docs`](http://localhost:8000/docs)

<details>
<summary><b>Core endpoints</b></summary>

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | API root |
| `GET` | `/health` | Health check |
| `POST` | `/upload` | Upload audio + optional settings JSON |
| `POST` | `/save-settings` | Persist equalizer settings |
| `POST` | `/load-settings` | Load saved settings |
| `POST` | `/save_schema` | Save frontend layout preset |
| `POST` | `/load_schema` | Load frontend layout preset |
| `GET` | `/sample/{mode}` | Get synthetic sample for any mode |

</details>

<details>
<summary><b>Generic mode</b></summary>

```
POST   /api/modes/generic/process
GET    /api/modes/generic/settings/default
POST   /api/modes/generic/validate-bands
POST   /api/modes/generic/upload-signal
GET    /api/modes/generic/signals
POST   /api/modes/generic/signal/{filename}/load
DELETE /api/modes/generic/signal/{filename}
```
</details>

<details>
<summary><b>Music mode</b></summary>

```
POST   /api/modes/music/process
GET    /api/modes/music/settings/default
GET    /api/modes/music/instruments
POST   /api/modes/music/separate-ai
GET    /api/modes/music/ai-stems/{job_id}/{stem_filename}
POST   /api/modes/music/upload-signal
GET    /api/modes/music/signals
POST   /api/modes/music/signal/{filename}/load
DELETE /api/modes/music/signal/{filename}
```
</details>

<details>
<summary><b>Animals mode</b></summary>

```
POST   /api/modes/animals/process
GET    /api/modes/animals/settings/default
GET    /api/modes/animals/animals
POST   /api/modes/animals/upload-signal
GET    /api/modes/animals/signals
POST   /api/modes/animals/signal/{filename}/load
DELETE /api/modes/animals/signal/{filename}
```
</details>

<details>
<summary><b>Humans mode</b></summary>

```
POST   /api/modes/humans/process
GET    /api/modes/humans/settings/default
GET    /api/modes/humans/voice-types
POST   /api/modes/humans/separate-ai
GET    /api/modes/humans/ai-stems/{job_id}/{stem_filename}
POST   /api/modes/humans/upload-signal
GET    /api/modes/humans/signals
POST   /api/modes/humans/signal/{filename}/load
DELETE /api/modes/humans/signal/{filename}
```
</details>

<details>
<summary><b>ECG mode</b></summary>

```
POST   /api/modes/ecg/process
GET    /api/modes/ecg/settings/default
GET    /api/modes/ecg/components
POST   /api/modes/ecg/upload-signal
GET    /api/modes/ecg/signals
POST   /api/modes/ecg/signal/{filename}/load
DELETE /api/modes/ecg/signal/{filename}
POST   /api/modes/ecg/ai-analyze
POST   /api/modes/ecg/ai-analyze-file
```
</details>

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | FastAPI · NumPy · SciPy · PyWavelets · SoundFile · Pandas · Torch · Torchaudio |
| **AI Models** | Demucs · SpeechBrain SepFormer · ResNet (ECG) |
| **Frontend** | React 18 · Vite · Axios · Chart.js · react-chartjs-2 |

---

## 🚀 Quick Start

```bash
# Start backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Start frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the backend needs to be running for signal processing to work.

> **Windows note:** If `npm run dev` is blocked by execution policy, use `npm.cmd run dev` instead.

---

## 📁 Project Structure

```text
Signal-Equalizer/
├─ backend/
│  ├─ main.py               # FastAPI app entry + synthetic signal generators
│  ├─ core/                  # Shared FFT/wavelet processing utilities
│  ├─ modes/
│  │  ├─ generic/            # Custom band equalization
│  │  ├─ music/              # Demucs stem separation + DSP
│  │  ├─ animals/            # Animal vocalization processing
│  │  ├─ humans/             # SepFormer voice separation + DSP
│  │  └─ ecg/                # Cardiac analysis + ResNet AI
│  ├─ models/                # AI model wrappers
│  ├─ settings/              # Default configs + user-saved presets
│  └─ uploads/               # Per-mode uploaded signal storage
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx             # Main application (modes, state, layout)
│  │  ├─ api.js              # Backend API client (all endpoints)
│  │  ├─ components/         # WaveformViewer, FFTChart, SpectrogramViewer, ...
│  │  ├─ hooks/              # useBackendProcessing (debounce + cancellation)
│  │  ├─ services/           # Service layer
│  │  ├─ modes/              # Per-mode band configurations
│  │  └─ mock/               # Offline development data
│  └─ package.json
└─ screenshots/              # README media assets
```

---

## 📝 License

This project is part of a signal processing coursework implementation.
