# Signal Equalizer 🎵

A comprehensive web application for audio signal equalization with frequency and wavelet domain analysis. Supports 5 distinct operation modes for different signal types.

## 🚀 Quick Start (5 minutes)

### Windows Users
```bash
# Terminal 1
run_backend.bat

# Terminal 2 (new terminal)
run_frontend.bat
```

### macOS/Linux Users
```bash
# Terminal 1
bash run_backend.sh

# Terminal 2 (new terminal)
bash run_frontend.sh
```

Then open http://localhost:5173 in your browser.

## 📋 Features

### 5 Operating Modes

1. **Generic Mode** - Custom frequency band equalization
   - Add/remove frequency subdivisions
   - Set frequency range and gain per band
   - Full flexibility for custom analysis

2. **Musical Instruments** - Isolate instrument tracks
   - Sliders: Bass, Piano, Vocals, Violin
   - Additional instruments: Drums, Guitar, Flute, Trumpet

3. **Animal Sounds** - Separate animal vocalizations
   - Sliders: Cat, Dog, Bird, Elephant
   - Additional animals: Lion, Sheep, Cow, Horse, Monkey, Frog

4. **Human Voices** - Distinguish multiple speakers
   - Sliders: Young, Old, Male, Female voices
   - Language support: Arabic, English, Spanish, French, German, Chinese

5. **ECG Abnormalities** - Cardiac signal analysis
   - Sliders: Normal, Atrial Fibrillation, Ventricular Tachycardia, Heart Block
   - Additional components: Premature Beats, Bradycardia, Tachycardia

### Additional Features

- 📊 Real-time FFT spectrum analysis
- 🎨 Spectrogram visualization
- 🌊 Wavelet decomposition (db4, haar, sym5, etc.)
- 💾 Save/load settings as JSON files
- 🎙️ Audio file upload with custom settings
- 🔗 Linked waveform viewers (synchronized zoom/pan)
- ⚙️ Audiogram scale support (linear/logarithmic)
- 🎵 Audio playback with transport controls

## 📁 Project Structure

```
Signal-Equalizer/
├── backend/                    # FastAPI server
│   ├── main.py                # Entry point
│   ├── core/                  # Shared utilities
│   ├── modes/                 # 5 mode implementations
│   │   ├── generic/
│   │   ├── music/
│   │   ├── animals/
│   │   ├── humans/
│   │   └── ECG/
│   └── requirements.txt
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── modes/             # Mode configurations
│   │   ├── api.js             # API client
│   │   └── App.jsx
│   └── package.json
├── run_backend.bat/.sh        # Quick start scripts
├── run_frontend.bat/.sh
├── SETUP.md                   # Detailed setup guide
├── QUICKSTART.md              # 5-minute quick start
└── IMPLEMENTATION_STATUS.md   # Complete status
```

## 🛠 Technology Stack

**Backend:**
- FastAPI (Python web framework)
- NumPy & SciPy (signal processing)
- PyWavelets (wavelet analysis)
- Pydantic (data validation)

**Frontend:**
- React 18
- Vite (build tool)
- Axios (API client)
- Pure CSS (styling)

## 📖 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 5 minutes ⭐
- **[SETUP.md](./SETUP.md)** - Complete setup and API documentation
- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - Detailed feature checklist

## 🎯 API Endpoints

All endpoints are available at `http://localhost:5000`:

```
Core:
  GET  /                              # API info
  POST /upload                        # Upload audio + settings
  POST /save-settings                 # Save JSON settings
  POST /load-settings                 # Load JSON settings
  GET  /health                        # Health check

Modes:
  POST /api/modes/generic/process     # Generic equalization
  POST /api/modes/music/process       # Music mode
  POST /api/modes/animals/process     # Animals mode
  POST /api/modes/humans/process      # Humans mode
  POST /api/modes/ecg/process         # ECG mode
  
  GET  /api/modes/*/settings/default  # Default settings
  GET  /api/modes/*/[items]           # Available items
```

See `http://localhost:5000/docs` for interactive API documentation.

## ⚙️ Settings File Format

Settings are saved as JSON for reuse:

```json
{
  "mode": "music",
  "bands": [
    {"id": "b1", "name": "Bass", "low": 20, "high": 250, "gain": 1.2},
    {"id": "b2", "name": "Piano", "low": 27, "high": 4186, "gain": 0.8}
  ],
  "sliders_freq": [1.2, 0.8, 1.0, 1.0],
  "wavelet": "db4",
  "wavelet_level": 6
}
```

## 🔧 Development

### Backend Development
```bash
cd backend
pip install -r requirements.txt
python -m pytest  # Run tests (when added)
python main.py    # Start server
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev       # Start dev server
npm run build     # Production build
npm run test      # Run tests (when added)
```

## 📊 Signal Processing

- **FFT-based:** Frequency domain analysis and equalization
- **Wavelet:** Multi-scale time-frequency analysis
- **Spectrograms:** Time-frequency representations
- **Real-time:** Updates as controls change

## ✨ Code Quality

- ✅ No code repetition (reusable service architecture)
- ✅ Type hints throughout (Pydantic models)
- ✅ Comprehensive error handling
- ✅ Clean separation of concerns
- ✅ RESTful API design
- ✅ CORS enabled for cross-origin requests

## 🚀 Next Steps

1. ✅ Start the application (see Quick Start above)
2. Explore each mode with sample data
3. Create/load custom settings files
4. Prepare test audio files for your use case
5. (Optional) Extend with custom modes or AI models

## 🐛 Troubleshooting

**Can't start backend?**
```bash
# Verify Python 3.8+
python --version

# Install dependencies
pip install -r requirements.txt

# Try again
python main.py
```

**Can't start frontend?**
```bash
# Verify Node 16+
node --version

# Clean install
npm cache clean --force
npm install
npm run dev
```

**Backend and frontend not communicating?**
- Verify both are running
- Check backend is on http://localhost:5000
- Check frontend is on http://localhost:5173
- Open browser developer tools (F12) for API errors

**Settings file won't load?**
- Ensure JSON format is valid
- Check file contains: mode, bands, sliders_freq
- Verify band objects have: id, name, low, high, gain

## 📝 License

This project is part of the Signal Processing course/assignment.

## 👥 Author

Developed for comprehensive audio signal analysis and equalization.

---

**Status:** ✅ Core implementation complete  
**Last Updated:** March 14, 2026
