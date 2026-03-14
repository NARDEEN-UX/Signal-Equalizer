"""
Humans Mode Endpoints
"""

from fastapi import APIRouter, HTTPException
import numpy as np
import json
import os
from .schema import HumansModeRequest, HumansModeResponse
from .humans_service import humans_service

router = APIRouter()


def load_default_settings():
    """Load default settings from JSON file"""
    settings_file = os.path.join(os.path.dirname(__file__), '../../../settings/humans_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


@router.post("/process", response_model=HumansModeResponse)
async def process_humans(request: HumansModeRequest):
    """
    Process signal with humans mode (voice-based) equalization
    
    Args:
        request: HumansModeRequest with signal, gains, and voice names
        
    Returns:
        Equalized signal and analysis
    """
    try:
        signal = np.array(request.signal)
        
        if len(request.gains) != len(request.voice_names):
            raise ValueError("Number of gains must match number of voices")
        
        # Process signal
        result = humans_service.process_signal(signal, request.gains, request.voice_names)
        
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
    """Get default settings for humans mode"""
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voice-types")
async def get_voice_types():
    """Get list of available voice characteristics"""
    return {
        "voice_types": list(humans_service.VOICE_RANGES.keys())
    }
