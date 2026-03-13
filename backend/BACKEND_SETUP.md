# Backend Setup Guide - FastAPI + Mode Structure

## Overview
The backend has been reorganized to use **FastAPI** with a clear, scalable mode-based architecture.

## Directory Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── core/                   # Shared utilities
│   ├── __init__.py
│   ├── config.py          # Centralized mode configurations
│   ├── dsp.py             # DSP processing functions (FFT, wavelets, etc.)
│   └── schemas.py         # Core Pydantic models
├── modes/                  # Mode-specific implementations
│   ├── __init__.py
│   ├── generic/           # Generic Mode (user-defined bands)
│   │   ├── __init__.py
│   │   ├── endpoints/     # REST API routes
│   │   │   └── __init__.py
│   │   ├── schemas/       # Pydantic request/response models
│   │   │   └── __init__.py
│   │   └── services/      # Business logic
│   │       └── __init__.py
│   ├── animal/            # Animal Sounds Mode
│   ├── ecg/               # ECG Abnormalities Mode
│   ├── human/             # Human Voices Mode
│   └── music/             # Musical Instruments Mode
│       (Same structure as generic/)
└── temp/                  # Temporary files (uploads, presets)
```

## API Endpoints

### Core Endpoints
- **POST /upload** - Upload audio file
- **GET /signal/info** - Get current signal info (FFT, spectrogram)
- **GET /modes** - List all available modes
- **GET /modes/{mode_id}** - Get specific mode info with requirements
- **POST /save_preset** - Save equalizer preset
- **GET /load_preset/{preset_name}** - Load preset
- **GET /list_presets** - List available presets

### Mode-Specific Endpoints

Each mode (generic, animal, ecg, human, music) has:

**Generic Mode**
- **GET /modes/generic/info** - Mode information
- **POST /modes/generic/process** - Process with custom subdivisions
- **POST /modes/generic/save_preset** - Save generic preset
- **GET /modes/generic/load_preset/{name}** - Load generic preset

**Customized Modes (animal, ecg, human, music)**
- **GET /modes/{mode}/info** - Mode information with requirements
- **POST /modes/{mode}/process** - Process signal with preset bands

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Run Development Server
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

## File Organization Details

### Core Modules

#### `core/config.py`
Defines mode configurations including:
- Slider labels
- Frequency bands
- Wavelet settings
- **Requirements** (for customized modes)

```python
MODE_CONFIGS = {
    'human': {
        'requirements': ['Male voice', 'Female voice', 'Young speaker', 'Old speaker']
    },
    'animal': {
        'requirements': ['Bird sounds', 'Dog barks', 'Cat meows', 'Other animal sounds']
    },
    ...
}
```

#### `core/dsp.py`
DSP utilities:
- `compute_fft()` - FFT computation
- `compute_spectrogram()` - Spectrogram generation
- `apply_freq_equalization()` - FFT-based equalization
- `apply_wavelet_equalization()` - Wavelet-based equalization
- `load_audio()` / `save_audio()` - File I/O

#### `core/schemas.py`
Shared Pydantic models for validation

### Mode Structure

Each mode folder contains:

**endpoints/__init__.py**
- FastAPI router with REST endpoints
- Signal processing route
- Preset management routes
- Returns standardized JSON responses

**schemas/__init__.py**
- Pydantic models for request validation
- EqualizationRequest (scales, use_wavelet)
- EqualizationResponse (output signal, FFT, spectrogram)

**services/__init__.py**
- Business logic (ModeService class)
- `process_signal()` - Core processing logic
- `get_mode_info()` - Mode information retrieval
- Encapsulates DSP operations

## Global Signal State

The application maintains a global `current_signal` that:
- Is populated via `/upload` endpoint
- Is used by all mode endpoints
- Can be processed with different modes without re-uploading

Example request flow:
```
1. POST /upload → (file uploaded, current_signal set)
2. GET /signal/info → (get input signal analysis)
3. POST /modes/generic/process → (process with scales)
4. → Returns output signal, FFT, spectrogram
```

## Data Formats

### Signal Processing Request
```json
{
  "scales": [1.0, 1.5, 0.8, 1.2],
  "use_wavelet": false,
  "wavelet_type": "db4"  // Optional for customized modes
}
```

### Signal Info Response
```json
{
  "length": 44100,
  "sample_rate": 44100,
  "duration": 1.0,
  "input_fft_freqs": [...],
  "input_fft_magnitude": [...]
}
```

### Mode Info Response
```json
{
  "id": "human",
  "name": "Human Voices",
  "slider_labels": ["Male Voice", "Female Voice", ...],
  "num_sliders": 4,
  "freq_bands": [[80, 180], [180, 300], ...],
  "requirements": ["Male voice", "Female voice", ...]
}
```

## Preset System

Presets are stored as JSON in `backend/temp/presets/`:

```json
{
  "name": "my_preset",
  "mode_id": "human",
  "settings": {
    "scales": [1.0, 1.5, 0.8, 1.2],
    "wavelet_type": "haar"
  }
}
```

## Development Notes

### Adding a New Mode
1. Create folder: `backend/modes/{mode_name}/`
2. Create subdirectories: `endpoints/`, `schemas/`, `services/`
3. Implement ` {ModeId}Service` class in `services/__init__.py`
4. Define Pydantic models in `schemas/__init__.py`
5. Create routes in `endpoints/__init__.py`
6. Add mode config to `core/config.py`
7. Import router in `main.py` and include: `app.include_router(router)`

### Error Handling
- All endpoints return 400 for bad requests
- 404 for not found resources
- 500 for server errors with error message

### CORS
- Configured to accept requests from all origins
- Suitable for development; restrict in production

## Frontend Integration

The frontend expects:
- Mode info endpoint returns `requirements` array
- Each mode has `allowAddSubdivision` flag
- Only "Generic Mode" allows adding/removing subdivisions
- Customized modes show preset requirements instead

See `frontend/src/config/modes.js` for frontend mode configuration.
