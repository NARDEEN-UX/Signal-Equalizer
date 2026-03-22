"""
Signal Equalizer Backend
Main application entry point for FastAPI server
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
import numpy as np
import soundfile as sf
import io
import os
import json
from datetime import datetime

# Import routers from modes
from modes.generic.endpoints.endpoint import router as generic_router
from modes.music.endpoints.endpoint import router as music_router
from modes.animals.endpoints.endpoint import router as animals_router
from modes.humans.endpoints.endpoint import router as humans_router
from modes.ecg.endpoints.endpoint import router as ecg_router

# Initialize FastAPI app
app = FastAPI(
    title="Signal Equalizer API",
    description="Audio signal equalization with frequency analysis",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generic_router, prefix="/api/modes/generic", tags=["Generic Mode"])
app.include_router(music_router, prefix="/api/modes/music", tags=["Music Mode"])
app.include_router(animals_router, prefix="/api/modes/animals", tags=["Animals Mode"])
app.include_router(humans_router, prefix="/api/modes/humans", tags=["Humans Mode"])
app.include_router(ecg_router, prefix="/api/modes/ecg", tags=["ECG Mode"])


class SaveSettingsRequest(BaseModel):
    mode: str = Field(min_length=1)
    settings: dict


class LoadSettingsRequest(BaseModel):
    filename: str = Field(min_length=1)


class SaveSchemaRequest(BaseModel):
    filename: str = Field(min_length=1)
    schema_data: dict = Field(alias="schema")


class LoadSchemaRequest(BaseModel):
    filename: str = Field(min_length=1)


def _safe_json_filename(filename: str) -> str:
    safe = os.path.basename(filename or "").strip()
    if not safe:
        raise ValueError("Invalid filename")
    if not safe.endswith('.json'):
        safe = f"{safe}.json"
    return safe


def _build_human_sample(sample_rate: int = 44100, seconds: float = 4.0) -> np.ndarray:
    n = int(sample_rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    voice_1 = 0.22 * np.sin(2 * np.pi * 110 * t) + 0.08 * np.sin(2 * np.pi * 220 * t)
    voice_2 = 0.18 * np.sin(2 * np.pi * 220 * t) + 0.06 * np.sin(2 * np.pi * 440 * t)
    voice_3 = 0.10 * np.sin(2 * np.pi * 350 * t) + 0.10 * np.sin(2 * np.pi * 700 * t)
    voice_4 = 0.06 * np.sin(2 * np.pi * 120 * t) + 0.07 * np.sin(2 * np.pi * 4000 * t)
    mix = voice_1 + voice_2 + voice_3 + voice_4
    peak = float(np.max(np.abs(mix))) if len(mix) else 1.0
    return (mix / peak * 0.9).astype(np.float32) if peak > 0 else mix.astype(np.float32)


def _build_generic_sample(sample_rate: int = 44100, seconds: float = 4.0) -> np.ndarray:
    """Synthetic signal: summation of pure single frequencies spread across the frequency range."""
    n = int(sample_rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    # Frequencies spanning the audible range
    freqs = [100, 250, 500, 1000, 2000, 4000, 8000, 12000, 16000]
    amplitudes = [0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.08, 0.06, 0.04]
    mix = np.zeros(n, dtype=np.float64)
    for freq, amp in zip(freqs, amplitudes):
        mix += amp * np.sin(2 * np.pi * freq * t)
    peak = float(np.max(np.abs(mix))) or 1.0
    return (mix / peak * 0.9).astype(np.float32)


def _build_music_sample(sample_rate: int = 44100, seconds: float = 4.0) -> np.ndarray:
    """Synthetic mixture aligned with Demucs 6-source stems."""
    n = int(sample_rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    # drums: pulse train + broadband click texture
    env = (np.sin(2 * np.pi * 2 * t) > 0.85).astype(np.float64)
    drums = 0.12 * env * np.sin(2 * np.pi * 120 * t) + 0.05 * env * np.sin(2 * np.pi * 2500 * t)
    # bass
    bass = 0.22 * np.sin(2 * np.pi * 55 * t) + 0.10 * np.sin(2 * np.pi * 110 * t)
    # vocals
    vocals = 0.16 * np.sin(2 * np.pi * 220 * t) + 0.08 * np.sin(2 * np.pi * 440 * t) + 0.05 * np.sin(2 * np.pi * 880 * t)
    # guitar
    guitar = 0.11 * np.sin(2 * np.pi * 110 * t) + 0.07 * np.sin(2 * np.pi * 330 * t) + 0.05 * np.sin(2 * np.pi * 990 * t)
    # piano
    piano = 0.10 * np.sin(2 * np.pi * 262 * t) + 0.08 * np.sin(2 * np.pi * 330 * t) + 0.06 * np.sin(2 * np.pi * 392 * t)
    # other
    other = 0.08 * np.sin(2 * np.pi * 660 * t) + 0.06 * np.sin(2 * np.pi * 1320 * t) + 0.04 * np.sin(2 * np.pi * 2640 * t)
    mix = drums + bass + vocals + guitar + piano + other
    peak = float(np.max(np.abs(mix))) or 1.0
    return (mix / peak * 0.9).astype(np.float32)


def _build_animals_sample(sample_rate: int = 44100, seconds: float = 4.0) -> np.ndarray:
    """Synthetic mixture of 4+ animal frequency bands."""
    n = int(sample_rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    # Songbirds (2000-12000 Hz)
    birds = 0.12 * np.sin(2 * np.pi * 3000 * t) + 0.08 * np.sin(2 * np.pi * 6000 * t) + 0.05 * np.sin(2 * np.pi * 10000 * t)
    # Canines (250-4000 Hz)
    canines = 0.15 * np.sin(2 * np.pi * 500 * t) + 0.10 * np.sin(2 * np.pi * 1500 * t)
    # Felines (100-8000 Hz)
    felines = 0.12 * np.sin(2 * np.pi * 700 * t) + 0.08 * np.sin(2 * np.pi * 2000 * t)
    # Large Mammals (20-2000 Hz)
    mammals = 0.20 * np.sin(2 * np.pi * 50 * t) + 0.12 * np.sin(2 * np.pi * 200 * t)
    # Insects (1000-20000 Hz)
    insects = 0.06 * np.sin(2 * np.pi * 4000 * t) + 0.04 * np.sin(2 * np.pi * 14000 * t)
    mix = birds + canines + felines + mammals + insects
    peak = float(np.max(np.abs(mix))) or 1.0
    return (mix / peak * 0.9).astype(np.float32)


def _build_ecg_sample(sample_rate: int = 500, seconds: float = 10.0) -> np.ndarray:
    """Synthetic ECG signal with components in non-overlapping frequency bands.

    Band layout (must match ecg_service.COMPONENT_RANGES):
      Normal Sinus:             0.5 – 3 Hz
      Atrial Fibrillation:      5 – 50 Hz
      Ventricular Tachycardia:  3 – 5 Hz
      Heart Block:              0.05 – 0.5 Hz
    """
    n = int(sample_rate * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    # Normal sinus rhythm, 1.2 Hz (72 bpm) + 2.4 Hz harmonic — inside [0.5, 3)
    normal = 0.35 * np.sin(2 * np.pi * 1.2 * t) + 0.15 * np.sin(2 * np.pi * 2.4 * t)
    # Atrial Fibrillation — rapid irregular activity inside [5, 50)
    af = 0.10 * np.sin(2 * np.pi * 7 * t) + 0.06 * np.sin(2 * np.pi * 15 * t) + 0.03 * np.sin(2 * np.pi * 35 * t)
    # Ventricular Tachycardia — inside [3, 5)
    vt = 0.12 * np.sin(2 * np.pi * 3.5 * t) + 0.08 * np.sin(2 * np.pi * 4.5 * t)
    # Heart Block — very slow inside [0.05, 0.5)
    hb = 0.14 * np.sin(2 * np.pi * 0.15 * t) + 0.08 * np.sin(2 * np.pi * 0.35 * t)
    mix = normal + af + vt + hb
    peak = float(np.max(np.abs(mix))) or 1.0
    return (mix / peak * 0.9).astype(np.float32)


# ==================== Core Endpoints ====================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Signal Equalizer API",
        "version": "1.0.0",
        "endpoints": {
            "generic": "/api/modes/generic",
            "music": "/api/modes/music",
            "animals": "/api/modes/animals",
            "humans": "/api/modes/humans",
            "ecg": "/api/modes/ecg"
        }
    }


@app.post("/upload")
async def upload_audio(audio: UploadFile = File(...), settings: UploadFile = None):
    """
    Upload audio file and optional settings file
    
    Args:
        audio: Audio file (wav, mp3, etc.)
        settings: Optional settings JSON file
        
    Returns:
        Audio metadata and loaded signal data
    """
    try:
        # Read audio file
        audio_data = await audio.read()
        audio_bytes = io.BytesIO(audio_data)
        signal, sample_rate = sf.read(audio_bytes)
        
        # Handle mono/stereo
        if len(signal.shape) > 1:
            signal = signal[:, 0]  # Convert to mono
        
        # Load settings if provided
        settings_data = None
        if settings:
            settings_content = await settings.read()
            settings_data = json.loads(settings_content)
        
        return JSONResponse({
            "status": "success",
            "audio": {
                "filename": audio.filename,
                "size": len(audio_data),
                "sample_rate": int(sample_rate),
                "duration": float(len(signal) / sample_rate),
                "samples": len(signal)
            },
            "signal": signal.tolist() if len(signal) < 100000 else None,  # Truncate large signals
            "settings": settings_data
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error uploading audio: {str(e)}")


@app.get("/sample/human")
async def sample_human():
    """Generate a deterministic sample clip used by the frontend sample button."""
    try:
        sample_rate = 44100
        signal = _build_human_sample(sample_rate=sample_rate)
        buffer = io.BytesIO()
        sf.write(buffer, signal, sample_rate, format='WAV')
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="human_sample.wav"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating sample: {str(e)}")


@app.get("/sample/generic")
async def sample_generic():
    """Generate a synthetic multi-frequency signal for generic mode validation."""
    try:
        sample_rate = 44100
        signal = _build_generic_sample(sample_rate=sample_rate)
        buffer = io.BytesIO()
        sf.write(buffer, signal, sample_rate, format='WAV')
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="generic_sample.wav"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating sample: {str(e)}")


@app.get("/sample/music")
async def sample_music():
    """Generate a synthetic 4-instrument mixture for music mode."""
    try:
        sample_rate = 44100
        signal = _build_music_sample(sample_rate=sample_rate)
        buffer = io.BytesIO()
        sf.write(buffer, signal, sample_rate, format='WAV')
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="music_sample.wav"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating sample: {str(e)}")


@app.get("/sample/animals")
async def sample_animals():
    """Generate a synthetic animal sounds mixture."""
    try:
        sample_rate = 44100
        signal = _build_animals_sample(sample_rate=sample_rate)
        buffer = io.BytesIO()
        sf.write(buffer, signal, sample_rate, format='WAV')
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="animals_sample.wav"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating sample: {str(e)}")


@app.get("/sample/ecg")
async def sample_ecg():
    """Generate a synthetic ECG signal with arrhythmia components."""
    try:
        sample_rate = 500
        signal = _build_ecg_sample(sample_rate=sample_rate)
        buffer = io.BytesIO()
        sf.write(buffer, signal, sample_rate, format='WAV')
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={"Content-Disposition": 'attachment; filename="ecg_sample.wav"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating sample: {str(e)}")


@app.post("/save-settings")
async def save_settings(payload: SaveSettingsRequest):
    """
    Save equalizer settings to a JSON file
    
    Args:
        mode: Mode name (generic, music, animals, humans, ecg)
        settings: Settings dictionary containing band info, gains, etc.
        
    Returns:
        Path to saved settings file
    """
    try:
        # Create settings directory if it doesn't exist
        settings_dir = "settings"
        os.makedirs(settings_dir, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{settings_dir}/{payload.mode}_settings_{timestamp}.json"
        
        # Save settings
        with open(filename, 'w') as f:
            json.dump(payload.settings, f, indent=2)
        
        return JSONResponse({
            "status": "success",
            "filename": filename,
            "message": f"Settings saved to {filename}"
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error saving settings: {str(e)}")


@app.post("/load-settings")
async def load_settings(payload: LoadSettingsRequest):
    """
    Load equalizer settings from a JSON file
    
    Args:
        filename: Path to settings JSON file
        
    Returns:
        Settings dictionary
    """
    try:
        safe_filename = _safe_json_filename(payload.filename)
        filepath = os.path.join("settings", safe_filename)
        with open(filepath, 'r') as f:
            settings = json.load(f)
        return JSONResponse({
            "status": "success",
            "settings": settings
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading settings: {str(e)}")


@app.post("/save_schema")
async def save_schema(payload: SaveSchemaRequest):
    """Save a frontend preset schema."""
    try:
        presets_dir = os.path.join("settings", "presets")
        os.makedirs(presets_dir, exist_ok=True)
        safe_filename = _safe_json_filename(payload.filename)
        filepath = os.path.join(presets_dir, safe_filename)

        with open(filepath, 'w') as f:
            json.dump(payload.schema_data, f, indent=2)

        return JSONResponse({
            "status": "success",
            "filename": safe_filename,
            "message": f"Preset saved to {safe_filename}"
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error saving schema: {str(e)}")


@app.post("/load_schema")
async def load_schema(payload: LoadSchemaRequest):
    """Load a frontend preset schema."""
    try:
        safe_filename = _safe_json_filename(payload.filename)
        filepath = os.path.join("settings", "presets", safe_filename)
        with open(filepath, 'r') as f:
            schema = json.load(f)
        return JSONResponse(schema)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading schema: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

