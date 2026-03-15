"""
ECG Mode Endpoints
"""

from fastapi import APIRouter, HTTPException
import numpy as np
import json
import os
from ..schemas.schema import ECGModeRequest, ECGModeResponse
from ..services.ecg_service import ecg_service
from ..services.ecg_ai_service import run_ecg_ai

router = APIRouter()


def load_default_settings():
    """Load default settings from JSON file"""
    settings_file = os.path.join(os.path.dirname(__file__), '../../../settings/ecg_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


@router.post("/process", response_model=ECGModeResponse)
async def process_ecg(request: ECGModeRequest):
    """
    Process ECG signal with arrhythmia component equalization
    
    Args:
        request: ECGModeRequest with signal, gains, and component names
        
    Returns:
        Equalized signal and analysis
    """
    try:
        signal = np.array(request.signal)
        
        if len(request.gains) != len(request.component_names):
            raise ValueError("Number of gains must match number of components")
        
        # Process signal
        result = ecg_service.process_signal(
            signal,
            request.gains,
            request.component_names,
            wavelet=request.wavelet,
            wavelet_level=request.wavelet_level,
            sliders_wavelet=request.sliders_wavelet,
        )
        
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
    """Get default settings for ECG mode"""
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/components")
async def get_ecg_components():
    """Get list of available ECG components"""
    return {
        "components": list(ecg_service.COMPONENT_RANGES.keys())
    }


@router.post("/ai-classify")
async def ai_classify_ecg(body: dict):
    """
    Run AI-based ECG arrhythmia classification.

    Accepts:
        { "signal": [...], "sample_rate": 500 }

    Returns:
        features, per-class scores, suggested gains, AI-separated output signal
    """
    try:
        signal = body.get("signal", [])
        fs = float(body.get("sample_rate", 500.0))
        if not signal:
            raise ValueError("signal must be a non-empty list")
        result = run_ecg_ai(signal, fs)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

