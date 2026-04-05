"""
ECG Mode Endpoints
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import numpy as np
import json
import os
import soundfile as sf
import io
from datetime import datetime
from ..schemas.schema import ECGModeRequest, ECGModeResponse
from ..services.ecg_service import ecg_service
from ..services.ecg_ai_service import ecg_ai_analyzer

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class ECGAIRequest(BaseModel):
    signal: List[float]
    sample_rate: int = 360


# Upload directory
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '../../../uploads/ecg')


def load_default_settings():
    settings_file = os.path.join(os.path.dirname(__file__),
                                 '../../../settings/ecg_default.json')
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise ValueError(f"Could not load default settings: {str(e)}")


# ==================== Equalizer ====================

@router.post("/process", response_model=ECGModeResponse)
async def process_ecg(request: ECGModeRequest):
    try:
        signal = np.array(request.signal)
        if len(request.gains) != len(request.component_names):
            raise ValueError("Number of gains must match number of components")
        result = ecg_service.process_signal(
            signal,
            request.gains,
            request.component_names,
            sample_rate=request.sample_rate,
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
            "band_waveforms": result.get("band_waveforms"),
            "processing_time": result["processing_time"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/settings/default")
async def get_default_settings():
    try:
        return load_default_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/components")
async def get_ecg_components():
    return {"components": list(ecg_service.COMPONENT_RANGES.keys())}


# ==================== Signal Upload Management ====================

@router.post("/upload-signal")
async def upload_ecg_signal(signal_file: UploadFile = File(...)):
    """
    Upload a WAV/CSV ECG file.
    - WAV  → read with soundfile, store as WAV
    - CSV  → read amplitude column, store as WAV at 360 Hz
    Returns the signal array so the frontend can use it immediately.
    """
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        audio_data = await signal_file.read()
        filename   = signal_file.filename or "ecg_upload"
        ext        = os.path.splitext(filename)[1].lower()

        # ── CSV upload ────────────────────────────────────────────────────────
        if ext == ".csv":
            import pandas as pd
            df = pd.read_csv(io.BytesIO(audio_data))
            # Accept either 'amplitude' column or the last numeric column
            amp_col = "amplitude" if "amplitude" in df.columns else df.columns[-1]
            signal  = df[amp_col].values.astype(np.float32)
            sample_rate = 360  # ECG CSV files are always 360 Hz

        # ── Audio upload (WAV / MP3 / etc.) ───────────────────────────────────
        else:
            audio_bytes = io.BytesIO(audio_data)
            signal, sample_rate = sf.read(audio_bytes)
            if len(signal.shape) > 1:
                signal = signal[:, 0]
            signal = signal.astype(np.float32)

        # Save as WAV
        timestamp      = datetime.now().strftime("%Y%m%d_%H%M%S")
        saved_filename = f"ecg_{timestamp}.wav"
        saved_path     = os.path.join(UPLOADS_DIR, saved_filename)
        sf.write(saved_path, signal, int(sample_rate))

        duration = float(len(signal) / sample_rate)

        return {
            "status":        "success",
            "filename":      saved_filename,
            "original_name": filename,
            "size":          len(audio_data),
            "sample_rate":   int(sample_rate),
            "duration":      duration,
            "samples":       len(signal),
            # Return signal only if small enough (<100k samples)
            "signal": signal.tolist() if len(signal) < 100_000 else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error uploading signal: {str(e)}")


@router.get("/signals")
async def list_ecg_signals():
    try:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        signals = []
        for filename in os.listdir(UPLOADS_DIR):
            if filename.startswith('ecg_') and filename.endswith(
                    ('.wav', '.mp3', '.flac', '.ogg', '.csv')):
                filepath  = os.path.join(UPLOADS_DIR, filename)
                file_size = os.path.getsize(filepath)
                try:
                    signal, sample_rate = sf.read(filepath)
                    if len(signal.shape) > 1:
                        signal = signal[:, 0]
                    signals.append({
                        "filename":    filename,
                        "size":        file_size,
                        "sample_rate": int(sample_rate),
                        "duration":    float(len(signal) / sample_rate),
                        "samples":     len(signal),
                    })
                except Exception:
                    pass
        return {"status": "success", "signals": signals, "count": len(signals)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error listing signals: {str(e)}")


@router.post("/signal/{filename}/load")
async def load_ecg_signal(filename: str):
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
            "status":      "success",
            "filename":    filename,
            "signal":      signal.tolist(),
            "sample_rate": int(sample_rate),
            "duration":    float(len(signal) / sample_rate),
            "samples":     len(signal),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error loading signal: {str(e)}")


@router.delete("/signal/{filename}")
async def delete_ecg_signal(filename: str):
    try:
        filepath = os.path.join(UPLOADS_DIR, filename)
        if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOADS_DIR)):
            raise HTTPException(status_code=403, detail="Access denied")
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Signal file not found")
        os.remove(filepath)
        return {"status": "success",
                "message": f"Signal {filename} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error deleting signal: {str(e)}")


# ==================== AI Diagnosis ====================

@router.post("/ai-analyze")
async def ai_analyze_ecg(request: ECGAIRequest):
    """
    Run AI diagnosis on an ECG signal.

    Input : { signal: float[], sample_rate: int }
    The signal can come from:
      - a WAV file read by the frontend (any SR → resampled to 360 Hz internally)
      - a CSV file's amplitude column (already 360 Hz)

    Returns full JSON with probabilities, GradCAM, freq/time importance.
    Short (<5 s) → single window.
    Long  (≥5 s) → sliding window with aggregate outputs.
    """
    try:
        if len(request.signal) < 10:
            raise ValueError("Signal too short (minimum 10 samples).")
        result = ecg_ai_analyzer.analyze(request.signal, request.sample_rate)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai-analyze-file")
async def ai_analyze_ecg_file(signal_file: UploadFile = File(...)):
    """
    Alternative endpoint: upload a WAV or CSV file directly for AI analysis.
    Useful for testing without going through the frontend state.
    """
    try:
        audio_data = await signal_file.read()
        filename   = signal_file.filename or ""
        ext        = os.path.splitext(filename)[1].lower()

        if ext == ".csv":
            import pandas as pd
            df  = pd.read_csv(io.BytesIO(audio_data))
            col = "amplitude" if "amplitude" in df.columns else df.columns[-1]
            sig = df[col].values.astype(np.float32)
            sr  = 360
        else:
            sig, sr = sf.read(io.BytesIO(audio_data))
            if len(sig.shape) > 1:
                sig = sig[:, 0]
            sig = sig.astype(np.float32)
            sr  = int(sr)

        if len(sig) < 10:
            raise ValueError("Signal too short.")

        result = ecg_ai_analyzer.analyze(sig.tolist(), sr)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))