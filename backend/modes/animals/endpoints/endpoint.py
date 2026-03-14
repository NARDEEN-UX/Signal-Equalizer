"""
Animals Mode Endpoints
"""

from fastapi import APIRouter, HTTPException
import numpy as np
import json
import os
from .schema import AnimalsModeRequest, AnimalsModeResponse
from .animals_service import animals_service

router = APIRouter()


def load_default_settings():
    """Load default settings from JSON file"""
    settings_file = os.path.join(os.path.dirname(__file__), '../../../settings/animals_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


@router.post("/process", response_model=AnimalsModeResponse)
async def process_animals(request: AnimalsModeRequest):
    """
    Process signal with animals mode (animal sound-based) equalization
    
    Args:
        request: AnimalsModeRequest with signal, gains, and animal names
        
    Returns:
        Equalized signal and analysis
    """
    try:
        signal = np.array(request.signal)
        
        if len(request.gains) != len(request.animal_names):
            raise ValueError("Number of gains must match number of animal sounds")
        
        # Process signal
        result = animals_service.process_signal(signal, request.gains, request.animal_names)
        
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
    """Get default settings for animals mode"""
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/animals")
async def get_available_animals():
    """Get list of available animal sounds"""
    return {
        "animals": list(animals_service.ANIMAL_RANGES.keys())
    }
