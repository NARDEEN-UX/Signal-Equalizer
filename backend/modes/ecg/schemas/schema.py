"""
Schemas for ECG Abnormalities Mode
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ECGComponentConfig(BaseModel):
    """Configuration for an ECG signal component"""
    name: str
    freq_ranges: List[tuple] = Field(description="List of (low, high) frequency ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class ECGModeRequest(BaseModel):
    """Request for ECG mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    gains: List[float] = Field(description="Gains for each ECG component (0-2)")
    component_names: List[str] = Field(description="Names of ECG components")
    sliders_wavelet: Optional[List[float]] = None
    wavelet: str = "db4"
    wavelet_level: int = 6


class ECGModeResponse(BaseModel):
    """Response from ECG mode processing"""
    status: str
    output_signal: List[float]
    output_fft: Optional[dict] = None
    input_spectrogram: Optional[dict] = None
    output_spectrogram: Optional[dict] = None
    processing_time: float


class ECGSettingsSchema(BaseModel):
    """Settings schema for ECG mode"""
    mode: str = "ecg"
    components: List[ECGComponentConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
