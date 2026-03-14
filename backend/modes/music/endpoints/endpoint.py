"""
Music Mode Endpoints
"""

from fastapi import APIRouter, HTTPException
import numpy as np
import json
import os
from ..schemas.schema import MusicModeRequest, MusicModeResponse
from ..services.music_service import music_service

router = APIRouter()


def load_default_settings():
    """Load default settings from JSON file"""
    settings_file = os.path.join(os.path.dirname(__file__), '../../../settings/music_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


@router.post("/process", response_model=MusicModeResponse)
async def process_music(request: MusicModeRequest):
    """
    Process signal with music mode (instrument-based) equalization
    
    Args:
        request: MusicModeRequest with signal, gains, and instrument names
        
    Returns:
        Equalized signal and analysis
    """
    try:
        signal = np.array(request.signal)
        
        if len(request.gains) != len(request.instrument_names):
            raise ValueError("Number of gains must match number of instruments")
        
        # Process signal
        result = music_service.process_signal(signal, request.gains, request.instrument_names)
        
        return {
            "status": "success",
            "output_signal": result["signal"],
            "output_fft": result["fft"],
            "output_spectrogram": result["spectrogram"],
            "processing_time": result["processing_time"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/settings/default")
async def get_default_settings():
    """Get default settings for music mode"""
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/instruments")
async def get_available_instruments():
    """Get list of available musical instruments"""
    return {
        "instruments": list(music_service.INSTRUMENT_RANGES.keys())
    }
