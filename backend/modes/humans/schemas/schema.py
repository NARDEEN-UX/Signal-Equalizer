"""
Schemas for Human Voices Mode
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class HumanVoiceConfig(BaseModel):
    """Configuration for a human voice"""
    name: str
    freq_ranges: List[tuple] = Field(description="List of (low, high) frequency ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class HumanBandConfig(BaseModel):
    """Band configuration for DSP processing"""
    id: str
    name: str
    low: float = Field(ge=0, description="Lower frequency bound in Hz")
    high: float = Field(gt=0, description="Upper frequency bound in Hz")
    ranges: Optional[List[tuple]] = Field(default=None, description="Optional list of (low, high) sub-ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class HumansModeRequest(BaseModel):
    """Request for humans mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    gains: List[float] = Field(description="Gains for each human voice (0-2)")
    voice_names: List[str] = Field(description="Names/descriptions of voices")
    bands: Optional[List[HumanBandConfig]] = None
    method: str = "fft"
    sliders_wavelet: Optional[List[float]] = None
    wavelet: str = "db4"
    wavelet_level: int = 6


class HumansModeResponse(BaseModel):
    """Response from humans mode processing"""
    status: str
    output_signal: List[float]
    input_fft: Optional[dict] = None
    output_fft: Optional[dict] = None
    input_spectrogram: Optional[dict] = None
    output_spectrogram: Optional[dict] = None
    input_coeffs: Optional[List[List[float]]] = None
    output_coeffs: Optional[List[List[float]]] = None
    band_waveforms: Optional[List[dict]] = None
    processing_time: float


class SeparatedVoiceComponent(BaseModel):
    """Single separated voice component output"""
    name: str
    source: str
    low: float
    high: float
    rms: float
    stem_filename: Optional[str] = None
    stem_url: Optional[str] = None
    signal: Optional[List[float]] = None


class HumansAISeparationRequest(BaseModel):
    """Request for AI-based human voice separation"""
    signal: List[float]
    sample_rate: int = 44100
    voice_names: List[str] = Field(default_factory=list, description="Optional subset of target voice labels")
    model_name: str = Field(default="speechbrain/sepformer-wsj02mix", description="SpeechBrain SepFormer model identifier")


class HumansAISeparationResponse(BaseModel):
    """Response for AI-based human voice separation"""
    status: str
    job_id: str
    model_name: str
    sample_rate: int
    components: List[SeparatedVoiceComponent]
    processing_time: float
    fallback: Optional[bool] = None
    warning: Optional[str] = None


class HumansSettingsSchema(BaseModel):
    """Settings schema for humans mode"""
    mode: str = "humans"
    voices: List[HumanVoiceConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
