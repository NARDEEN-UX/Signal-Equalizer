"""
Animals Mode Endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
import numpy as np
import json
import os
import soundfile as sf
import io
from datetime import datetime
from ..schemas.schema import AnimalsModeRequest, AnimalsModeResponse
from ..services.animals_service import animals_service

router = APIRouter()

# Upload directory for animals mode signals
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/animals')


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


# ==================== Signal Upload Management ====================

@router.post("/upload-signal")
async def upload_animal_signal(signal_file: UploadFile = File(...)):
    """Upload an animal signal file and save it to animals-specific storage"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        audio_data = await signal_file.read()
        audio_bytes = io.BytesIO(audio_data)
        signal, sample_rate = sf.read(audio_bytes)
        
        if len(signal.shape) > 1:
            signal = signal[:, 0]
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = os.path.splitext(signal_file.filename)[1]
        saved_filename = f"animal_{timestamp}{file_extension}"
        saved_path = os.path.join(UPLOADS_DIR, saved_filename)
        
        sf.write(saved_path, signal, int(sample_rate))
        
        return {
            "status": "success",
            "filename": saved_filename,
            "original_name": signal_file.filename,
            "size": len(audio_data),
            "sample_rate": int(sample_rate),
            "duration": float(len(signal) / sample_rate),
            "samples": len(signal),
            "signal": signal.tolist() if len(signal) < 100000 else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error uploading signal: {str(e)}")


@router.get("/signals")
async def list_animal_signals():
    """List all uploaded animal signals"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        signals = []
        
        for filename in os.listdir(UPLOADS_DIR):
            if filename.startswith('animal_') and filename.endswith(('.wav', '.mp3', '.flac', '.ogg')):
                filepath = os.path.join(UPLOADS_DIR, filename)
                file_size = os.path.getsize(filepath)
                signal, sample_rate = sf.read(filepath)
                
                if len(signal.shape) > 1:
                    signal = signal[:, 0]
                
                signals.append({
                    "filename": filename,
                    "size": file_size,
                    "sample_rate": int(sample_rate),
                    "duration": float(len(signal) / sample_rate),
                    "samples": len(signal)
                })
        
        return {
            "status": "success",
            "signals": signals,
            "count": len(signals)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error listing signals: {str(e)}")


@router.post("/signal/{filename}/load")
async def load_animal_signal(filename: str):
    """Load a specific animal signal for processing"""
    try:
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOADS_DIR)):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Signal file not found")
        
        signal, sample_rate = sf.read(filepath)
        if len(signal.shape) > 1:
            signal = signal[:, 0]
        
        return {
            "status": "success",
            "filename": filename,
            "signal": signal.tolist(),
            "sample_rate": int(sample_rate),
            "duration": float(len(signal) / sample_rate),
            "samples": len(signal)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading signal: {str(e)}")


@router.delete("/signal/{filename}")
async def delete_animal_signal(filename: str):
    """Delete a specific uploaded animal signal"""
    try:
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOADS_DIR)):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Signal file not found")
        
        os.remove(filepath)
        
        return {
            "status": "success",
            "message": f"Signal {filename} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error deleting signal: {str(e)}")
