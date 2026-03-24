"""
Music Mode Endpoints
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
    MusicModeRequest,
    MusicModeResponse,
    MusicDemucsSeparationRequest,
    MusicDemucsSeparationResponse
)
from ..services.music_service import music_service

router = APIRouter()

# Upload directory for music mode signals
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/music')
AI_STEMS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/music/ai_stems')


def _safe_stem_slug(name: str) -> str:
    slug = re.sub(r'[^a-z0-9_-]+', '_', str(name or '').strip().lower())
    return slug.strip('_') or "stem"


def _safe_upload_filename(name: str) -> str:
    raw = os.path.basename(str(name or '').strip())
    if not raw:
        return f"music_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"

    # Keep readable original names while stripping dangerous characters.
    safe = re.sub(r'[^A-Za-z0-9._ -]+', '_', raw).strip(' .')
    if not safe:
        return f"music_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
    return safe


def _dedupe_filename(upload_dir: str, filename: str) -> str:
    base, ext = os.path.splitext(filename)
    candidate = filename
    counter = 1
    while os.path.exists(os.path.join(upload_dir, candidate)):
        candidate = f"{base} ({counter}){ext}"
        counter += 1
    return candidate


def load_default_settings():
    """Load default settings from JSON file"""
    settings_file = os.path.join(os.path.dirname(__file__), '../../../settings/music_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


@router.post("/process", response_model=MusicModeResponse)
async def process_music(request: MusicModeRequest):
    """
    Process signal with music mode (instrument-based) equalization
    
    Args:
        request: MusicModeRequest with signal, gains, and instrument names
        
    Returns:
        Equalized signal and analysis
    """
    try:
        signal = np.array(request.signal)
        
        if len(request.gains) != len(request.instrument_names):
            raise ValueError("Number of gains must match number of instruments")

        bands = None
        if request.bands:
            bands = [
                (b.model_dump() if hasattr(b, "model_dump") else b.dict())
                for b in request.bands
            ]
        
        # Process signal
        result = music_service.process_signal(
            signal,
            request.gains,
            request.instrument_names,
            sample_rate=request.sample_rate,
            bands=bands,
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
    """Get default settings for music mode"""
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/instruments")
async def get_available_instruments():
    """Get list of available musical instruments"""
    return {
        "instruments": list(music_service.INSTRUMENT_RANGES.keys())
    }


@router.post("/separate-ai", response_model=MusicDemucsSeparationResponse)
async def separate_music_ai(request: MusicDemucsSeparationRequest):
    """
    Run Demucs source separation and return components aligned to requested instrument labels.
    """
    try:
        signal = np.array(request.signal, dtype=np.float32)
        if signal.size == 0:
            raise ValueError("Signal is empty")
        sample_rate = max(1, int(request.sample_rate))

        result = music_service.separate_with_demucs(
            signal=signal,
            instrument_names=request.instrument_names,
            sample_rate=sample_rate,
            model_name=request.model_name
        )

        job_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        job_dir = os.path.join(AI_STEMS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        output_components = []
        for idx, component in enumerate(result["components"]):
            stem_signal = np.asarray(component.get("signal", []), dtype=np.float32)
            source_name = str(component.get("name", f"stem_{idx}"))
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
                "stem_url": f"/api/modes/music/ai-stems/{job_id}/{stem_filename}",
                "signal": stem_signal.tolist()
            })

        return {
            "status": "success",
            "job_id": job_id,
            "model_name": result["model_name"],
            "sample_rate": result["sample_rate"],
            "components": output_components,
            "processing_time": result["processing_time"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ai-stems/{job_id}/{stem_filename}")
async def get_ai_stem_file(job_id: str, stem_filename: str):
    """Serve generated Demucs stem wav files."""
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
async def upload_music_signal(signal_file: UploadFile = File(...)):
    """Upload a music signal file and save it to music-specific storage"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        audio_data = await signal_file.read()
        audio_bytes = io.BytesIO(audio_data)
        signal, sample_rate = sf.read(audio_bytes)
        
        if len(signal.shape) > 1:
            signal = signal[:, 0]

        requested_name = _safe_upload_filename(signal_file.filename)
        saved_filename = _dedupe_filename(UPLOADS_DIR, requested_name)
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
async def list_music_signals():
    """List all uploaded music signals"""
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        signals = []
        
        for filename in os.listdir(UPLOADS_DIR):
            if filename.endswith(('.wav', '.mp3', '.flac', '.ogg')):
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
async def load_music_signal(filename: str):
    """Load a specific music signal for processing"""
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
async def delete_music_signal(filename: str):
    """Delete a specific uploaded music signal"""
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
