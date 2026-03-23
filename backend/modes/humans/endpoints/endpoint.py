"""
Humans Mode Endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
import numpy as np
import json
import os
import soundfile as sf
import io
from datetime import datetime
import re
from ..schemas.schema import (
    HumansModeRequest,
    HumansModeResponse,
    HumansAISeparationRequest,
    HumansAISeparationResponse
)
from ..services.humans_service import humans_service

router = APIRouter()

# Upload directory for humans mode signals
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/humans')
AI_STEMS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/humans/ai_stems')


def _safe_stem_slug(name: str) -> str:
    slug = re.sub(r'[^a-z0-9_-]+', '_', str(name or '').strip().lower())
    return slug.strip('_') or "stem"


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
        result = humans_service.process_signal(
            signal, 
            request.gains, 
            request.voice_names, 
            sample_rate=request.sample_rate,
            bands=[
                (b.model_dump() if hasattr(b, "model_dump") else b.dict())
                for b in request.bands
            ] if request.bands else None,
            method=request.method,
            wavelet=request.wavelet,
            wavelet_level=request.wavelet_level,
            sliders_wavelet=request.sliders_wavelet
        )
        
        return {
            "status": "success",
            "output_signal": result["signal"],
            "input_fft": result.get("input_fft"),
            "output_fft": result["fft"],
            "input_spectrogram": result.get("input_spectrogram"),
            "output_spectrogram": result["spectrogram"],
            "input_coeffs": result.get("input_coeffs"),
            "output_coeffs": result.get("output_coeffs"),
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


@router.post("/separate-ai", response_model=HumansAISeparationResponse)
async def separate_humans_ai(request: HumansAISeparationRequest):
    """
    Run AI voice separation and return components aligned to requested labels.
    """
    try:
        signal = np.array(request.signal, dtype=np.float32)
        if signal.size == 0:
            raise ValueError("Signal is empty")
        sample_rate = max(1, int(request.sample_rate))

        result = humans_service.separate_with_ai(
            signal=signal,
            voice_names=request.voice_names,
            sample_rate=sample_rate,
            model_name=request.model_name
        )

        job_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        job_dir = os.path.join(AI_STEMS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        output_components = []
        for idx, component in enumerate(result["components"]):
            stem_signal = np.asarray(component.get("signal", []), dtype=np.float32)
            source_name = str(component.get("name", f"voice_{idx}"))
            safe_name = _safe_stem_slug(source_name)
            stem_filename = f"{idx:02d}_{safe_name}.wav"
            stem_path = os.path.join(job_dir, stem_filename)
            sf.write(stem_path, stem_signal, int(result["sample_rate"]))

            output_components.append({
                "name": source_name,
                "source": str(component.get("source", source_name)),
                "low": float(component.get("low", 20.0)),
                "high": float(component.get("high", 20000.0)),
                "rms": float(component.get("rms", 0.0)),
                "stem_filename": stem_filename,
                "stem_url": f"/api/modes/humans/ai-stems/{job_id}/{stem_filename}",
                "signal": stem_signal.tolist()
            })

        return {
            "status": "success",
            "job_id": job_id,
            "model_name": result["model_name"],
            "sample_rate": result["sample_rate"],
            "components": output_components,
            "processing_time": result["processing_time"],
            "fallback": result.get("fallback"),
            "warning": result.get("warning")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ai-stems/{job_id}/{stem_filename}")
async def get_ai_stem_file(job_id: str, stem_filename: str):
    """Serve generated AI stem wav files."""
    try:
        if not re.fullmatch(r"[0-9_]+", job_id or ""):
            raise HTTPException(status_code=400, detail="Invalid job id")
        if '..' in stem_filename or '/' in stem_filename or '\\' in stem_filename:
            raise HTTPException(status_code=400, detail="Invalid stem filename")

        stem_path = os.path.join(AI_STEMS_DIR, job_id, stem_filename)
        abs_root = os.path.abspath(AI_STEMS_DIR)
        abs_path = os.path.abspath(stem_path)
        if not abs_path.startswith(abs_root):
            raise HTTPException(status_code=403, detail="Access denied")
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="Stem file not found")

        return FileResponse(abs_path, media_type="audio/wav", filename=stem_filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read stem file: {str(e)}")


# ==================== Signal Upload Management ====================

@router.post("/upload-signal")
async def upload_human_signal(signal_file: UploadFile = File(...)):
    """Upload a human signal file and save it to humans-specific storage"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        audio_data = await signal_file.read()
        audio_bytes = io.BytesIO(audio_data)
        signal, sample_rate = sf.read(audio_bytes)
        
        if len(signal.shape) > 1:
            signal = signal[:, 0]
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = os.path.splitext(signal_file.filename)[1]
        saved_filename = f"human_{timestamp}{file_extension}"
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
async def list_human_signals():
    """List all uploaded human signals"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        signals = []
        
        for filename in os.listdir(UPLOADS_DIR):
            if filename.startswith('human_') and filename.endswith(('.wav', '.mp3', '.flac', '.ogg')):
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
async def load_human_signal(filename: str):
    """Load a specific human signal for processing"""
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
async def delete_human_signal(filename: str):
    """Delete a specific uploaded human signal"""
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
