"""Generic mode endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
import numpy as np
from core.dsp import compute_fft, compute_spectrogram
from ..services import GenericModeService
from ..schemas import GenericEqualizationRequest

router = APIRouter(prefix="/modes/generic", tags=["generic"])

# Shared state for signal processing
current_signal = None
sample_rate = None
generic_service = GenericModeService()

@router.get("/info")
async def get_generic_mode_info():
    """Get generic mode information"""
    return generic_service.get_mode_info()

@router.post("/process")
async def process_generic_equalization(request: GenericEqualizationRequest):
    """
    Process signal with generic equalization
    """
    global current_signal
    
    if current_signal is None:
        raise HTTPException(status_code=400, detail="No signal loaded. Upload audio first.")
    
    try:
        # Convert subdivisions to freq_bands
        freq_bands = [(sub.low_freq, sub.high_freq) for sub in request.subdivisions]
        
        result = generic_service.process_signal(
            current_signal,
            freq_bands,
            request.scales,
            request.use_wavelet
        )
        
        return {
            "message": "processed",
            "output_signal": result['signal'].tolist(),
            "output_fft_freqs": result['fft_freqs'].tolist(),
            "output_fft_magnitude": result['fft_magnitude'].tolist(),
            "output_spectrogram_freqs": result['spec_freqs'].tolist(),
            "output_spectrogram_times": result['spec_times'].tolist(),
            "output_spectrogram_power": result['spec_power'].tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save_preset")
async def save_generic_preset(name: str, subdivisions: List[dict]):
    """Save generic mode preset"""
    # Implementation for saving presets
    return {"message": "preset saved", "name": name}

@router.get("/load_preset/{preset_name}")
async def load_generic_preset(preset_name: str):
    """Load generic mode preset"""
    # Implementation for loading presets
    return {"message": "preset loaded", "name": preset_name}
