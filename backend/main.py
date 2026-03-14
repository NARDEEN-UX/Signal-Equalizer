"""
Signal Equalizer Backend
Main application entry point for FastAPI server
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from modes.ECG.endpoints.endpoint import router as ecg_router

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


@app.post("/save-settings")
async def save_settings(mode: str, settings: dict):
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
        filename = f"{settings_dir}/{mode}_settings_{timestamp}.json"
        
        # Save settings
        with open(filename, 'w') as f:
            json.dump(settings, f, indent=2)
        
        return JSONResponse({
            "status": "success",
            "filename": filename,
            "message": f"Settings saved to {filename}"
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error saving settings: {str(e)}")


@app.post("/load-settings")
async def load_settings(filename: str):
    """
    Load equalizer settings from a JSON file
    
    Args:
        filename: Path to settings JSON file
        
    Returns:
        Settings dictionary
    """
    try:
        with open(filename, 'r') as f:
            settings = json.load(f)
        return JSONResponse({
            "status": "success",
            "settings": settings
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading settings: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

