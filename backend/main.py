"""
Main FastAPI application for Signal Equalizer
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import soundfile as sf
import os
from typing import List

# Import mode routers
from modes.generic.endpoints import router as generic_router
from modes.animal.endpoints import router as animal_router
from modes.ecg.endpoints import router as ecg_router
from modes.human.endpoints import router as human_router
from modes.music.endpoints import router as music_router

# Import utilities
from core.dsp import compute_fft, compute_spectrogram, load_audio, normalize_signal
from core.config import MODE_CONFIGS

# Initialize FastAPI app
app = FastAPI(
    title="Signal Equalizer API",
    description="Web application for audio signal equalization",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create temp folder for uploads
UPLOAD_FOLDER = 'temp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global state for current signal
current_signal = None
sample_rate = None

# Include mode routers
app.include_router(generic_router)
app.include_router(animal_router)
app.include_router(ecg_router)
app.include_router(human_router)
app.include_router(music_router)

# ==================== Core Endpoints ====================

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Signal Equalizer API", "version": "1.0.0"}

@app.post("/upload")
async def upload_audio(audio: UploadFile = File(...)):
    """
    Upload and process audio file.
    Returns signal duration and sample rate.
    """
    global current_signal, sample_rate
    
    if not audio.filename:
        raise HTTPException(status_code=400, detail="Empty filename")
    
    try:
        path = os.path.join(UPLOAD_FOLDER, 'input.wav')
        with open(path, 'wb') as f:
            contents = await audio.read()
            f.write(contents)
        
        current_signal, sample_rate = load_audio(path)
        
        if current_signal is None:
            raise HTTPException(status_code=400, detail="Failed to load audio")
        
        # Normalize signal
        current_signal = normalize_signal(current_signal)
        
        return {
            "message": "uploaded",
            "length": len(current_signal),
            "sample_rate": sample_rate,
            "duration": len(current_signal) / sample_rate
        }
    except Exception as e:
        current_signal = None
        sample_rate = None
        raise HTTPException(status_code=400, detail=f"Failed to upload audio: {str(e)}")

@app.get("/signal/info")
async def get_signal_info():
    """Get current signal information"""
    global current_signal, sample_rate
    
    if current_signal is None:
        raise HTTPException(status_code=400, detail="No signal loaded")
    
    # Compute FFT and spectrogram for input signal
    freqs, magnitude = compute_fft(current_signal, sample_rate)
    f, t, Sxx = compute_spectrogram(current_signal, sample_rate)
    
    return {
        "length": len(current_signal),
        "sample_rate": sample_rate,
        "duration": len(current_signal) / sample_rate,
        "input_fft_freqs": freqs.tolist()[:1000],  # Limit to avoid huge response
        "input_fft_magnitude": magnitude.tolist()[:1000],
        "input_spectrogram_freqs": f.tolist(),
        "input_spectrogram_times": t.tolist(),
        "input_spectrogram_power": Sxx.tolist()
    }

@app.get("/modes")
async def get_all_modes():
    """Get all available modes with their information"""
    modes_info = {}
    for mode_id, config in MODE_CONFIGS.items():
        modes_info[mode_id] = {
            "name": config.get('name'),
            "slider_labels": config.get('slider_labels'),
            "num_sliders": config.get('num_sliders'),
            "requirements": config.get('requirements', [])
        }
    return modes_info

@app.get("/modes/{mode_id}")
async def get_mode_info(mode_id: str):
    """Get specific mode information"""
    if mode_id not in MODE_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Mode {mode_id} not found")
    
    config = MODE_CONFIGS[mode_id]
    return {
        "id": mode_id,
        "name": config.get('name'),
        "slider_labels": config.get('slider_labels'),
        "num_sliders": config.get('num_sliders'),
        "freq_bands": config.get('freq_bands'),
        "wavelet": config.get('wavelet'),
        "wavelet_levels": config.get('wavelet_levels'),
        "requirements": config.get('requirements', [])
    }

@app.post("/save_preset")
async def save_preset(name: str, mode_id: str, settings: dict):
    """Save a preset configuration"""
    # Implementation for saving presets to JSON files
    import json
    preset_folder = os.path.join(UPLOAD_FOLDER, 'presets')
    os.makedirs(preset_folder, exist_ok=True)
    
    preset_path = os.path.join(preset_folder, f"{name}.json")
    preset_data = {
        "name": name,
        "mode_id": mode_id,
        "settings": settings
    }
    
    with open(preset_path, 'w') as f:
        json.dump(preset_data, f, indent=2)
    
    return {"message": "Preset saved", "name": name}

@app.get("/load_preset/{preset_name}")
async def load_preset(preset_name: str):
    """Load a preset configuration"""
    import json
    preset_folder = os.path.join(UPLOAD_FOLDER, 'presets')
    preset_path = os.path.join(preset_folder, f"{preset_name}.json")
    
    if not os.path.exists(preset_path):
        raise HTTPException(status_code=404, detail=f"Preset {preset_name} not found")
    
    with open(preset_path, 'r') as f:
        preset_data = json.load(f)
    
    return preset_data

@app.get("/list_presets")
async def list_presets():
    """List all available presets"""
    import json
    preset_folder = os.path.join(UPLOAD_FOLDER, 'presets')
    
    if not os.path.exists(preset_folder):
        return {"presets": []}
    
    presets = [f[:-5] for f in os.listdir(preset_folder) if f.endswith('.json')]
    return {"presets": presets}

