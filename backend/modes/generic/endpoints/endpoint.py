"""
Generic Mode Endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import List
import numpy as np
import json
import os
from ..schemas.schema import GenericModeRequest, GenericModeResponse, GenericSettingsSchema
from ..services.generic_service import generic_service

router = APIRouter()


def load_default_settings():
    """Load default settings from JSON file"""
    settings_file = os.path.join(os.path.dirname(__file__), '../../../settings/generic_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


@router.post("/process", response_model=GenericModeResponse)
async def process_generic(request: GenericModeRequest):
    """
    Process signal with generic mode equalization
    
    Args:
        request: GenericModeRequest with signal, bands, and gains
        
    Returns:
        Equalized signal and analysis
    """
    try:
        signal = np.array(request.signal)
        
        # Validate band configuration
        is_valid, message = generic_service.validate_band_config(request.bands)
        if not is_valid:
            raise ValueError(message)
        
        # Extract band frequencies and convert to list of dicts
        bands = [{"low": b.low, "high": b.high} for b in request.bands]
        
        # Extract gains from band configs or use defaults
        gains = [b.gain for b in request.bands]
        
        # Process signal
        result = generic_service.process_signal(signal, bands, gains)
        
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
    """Get default settings for generic mode"""
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-bands")
async def validate_bands(bands: List[dict]):
    """Validate band configuration"""
    is_valid, message = generic_service.validate_band_config(bands)
    return {
        "valid": is_valid,
        "message": message
    }
