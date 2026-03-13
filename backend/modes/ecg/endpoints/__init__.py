"""ECG mode endpoints"""
from fastapi import APIRouter, HTTPException
from typing import List
import numpy as np
from ..services import ECGModeService
from ..schemas import ECGEqualizationRequest

router = APIRouter(prefix="/modes/ecg", tags=["ecg"])

current_signal = None
sample_rate = None
service = ECGModeService()

@router.get("/info")
async def get_ecg_mode_info():
    """Get ECG mode information with requirements"""
    return service.get_mode_info()

@router.post("/process")
async def process_ecg_equalization(request: ECGEqualizationRequest):
    """Process signal with ECG mode equalization"""
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
