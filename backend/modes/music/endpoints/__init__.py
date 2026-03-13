"""Music mode endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
import numpy as np
from ..services import MusicModeService
from ..schemas import MusicEqualizationRequest

router = APIRouter(prefix="/modes/music", tags=["music"])

current_signal = None
sample_rate = None
service = MusicModeService()

@router.get("/info")
async def get_music_mode_info():
    """Get music mode information with requirements"""
    return service.get_mode_info()

@router.post("/process")
async def process_music_equalization(request: MusicEqualizationRequest):
    """Process signal with music mode equalization"""
    global current_signal
    
    if current_signal is None:
        raise HTTPException(status_code=400, detail="No signal loaded. Upload audio first.")
    
    try:
        result = service.process_signal(
            current_signal,
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
