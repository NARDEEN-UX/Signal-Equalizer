"""
Generic Mode Endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
import numpy as np
import json
import os
import io
import soundfile as sf
from datetime import datetime
from ..schemas.schema import GenericModeRequest, GenericModeResponse, GenericSettingsSchema
from ..services.generic_service import generic_service

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/generic')

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

        # Convert Pydantic models to plain dicts for service validation/processing.
        bands = [{"low": b.low, "high": b.high} for b in request.bands]
        
        # Validate band configuration
        is_valid, message = generic_service.validate_band_config(bands)
        if not is_valid:
            raise ValueError(message)
        
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


@router.post("/upload-signal")
async def upload_signal(signal_file: UploadFile = File(...)):
    """Upload a signal file for generic mode"""
    try:
        # Ensure upload directory exists
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        
        content = await signal_file.read()
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_ext = signal_file.filename.split('.')[-1] if '.' in signal_file.filename else 'wav'
        filename = f"generic_{timestamp}.{file_ext}"
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        # Read audio file
        audio_data, sample_rate = sf.read(io.BytesIO(content))
        
        # Ensure mono
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Normalize
        max_val = np.max(np.abs(audio_data))
        if max_val > 0:
            audio_data = audio_data / max_val
        
        # Save audio file
        sf.write(filepath, audio_data, sample_rate)
        
        return {
            "status": "success",
            "filename": filename,
            "message": f"Signal uploaded: {filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")


@router.get("/signals")
async def list_signals():
    """List all uploaded signals for generic mode"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        signals = []
        
        for filename in os.listdir(UPLOADS_DIR):
            if filename.startswith('generic_') and filename.endswith(('.wav', '.mp3', '.flac', '.ogg')):
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
        
        # Sort by filename (newest first)
        signals.sort(key=lambda x: x['filename'], reverse=True)
        
        return {
            "status": "success",
            "signals": signals,
            "count": len(signals)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/signal/{filename}/load")
async def load_signal(filename: str):
    """Load a specific signal"""
    try:
        # Prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise ValueError("Invalid filename")
        
        # Ensure filename starts with generic_
        if not filename.startswith('generic_'):
            raise ValueError("Invalid signal file")
        
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        # Additional path traversal check
        if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOADS_DIR)):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Signal file not found")
        
        # Read audio file
        audio_data, sample_rate = sf.read(filepath)
        
        # Convert to mono if needed
        if len(audio_data.shape) > 1:
            audio_data = audio_data[:, 0]
        
        return {
            "status": "success",
            "filename": filename,
            "signal": audio_data.tolist(),
            "sample_rate": int(sample_rate),
            "duration": float(len(audio_data) / sample_rate),
            "samples": len(audio_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading signal: {str(e)}")


@router.delete("/signal/{filename}")
async def delete_signal(filename: str):
    """Delete a signal file"""
    try:
        # Prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise ValueError("Invalid filename")
        
        filepath = os.path.join(UPLOADS_DIR, filename)
        
        # Additional path traversal check
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
