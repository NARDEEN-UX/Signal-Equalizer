"""
Schemas for Music Mode
"""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class InstrumentConfig(BaseModel):
    """Configuration for a musical instrument"""
    name: str
    freq_ranges: List[tuple] = Field(description="List of (low, high) frequency ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class MusicBandConfig(BaseModel):
    """Band configuration for DSP processing"""
    id: str
    name: str
    low: float = Field(ge=0, description="Lower frequency bound in Hz")
    high: float = Field(gt=0, description="Upper frequency bound in Hz")
    ranges: Optional[List[tuple]] = Field(default=None, description="Optional list of (low, high) sub-ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class MusicModeRequest(BaseModel):
    """Request for music mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    gains: List[float] = Field(description="Gains for each instrument (0-2)")
    instrument_names: List[str] = Field(description="Names of instruments")
    bands: Optional[List[MusicBandConfig]] = None
    method: str = "wavelet"
    sliders_wavelet: Optional[List[float]] = None
    wavelet: str = "db4"
    wavelet_level: int = 6


class MusicModeResponse(BaseModel):
    """Response from music mode processing"""
    status: str
    output_signal: List[float]
    input_fft: Optional[dict] = None
    output_fft: Optional[dict] = None
    input_spectrogram: Optional[dict] = None
    output_spectrogram: Optional[dict] = None
    input_coeffs: Optional[List[List[float]]] = None
    output_coeffs: Optional[List[List[float]]] = None
    processing_time: float


class SeparatedComponent(BaseModel):
    """Single separated component output"""
    name: str
    source: str
    low: float
    high: float
    rms: float
    stem_filename: Optional[str] = None
    stem_url: Optional[str] = None
    signal: Optional[List[float]] = None


class MusicDemucsSeparationRequest(BaseModel):
    """Request for Demucs-based music source separation"""
    signal: List[float]
    sample_rate: int = 44100
    instrument_names: List[str] = Field(default_factory=list, description="Optional subset of target instrument names")
    model_name: str = Field(default="htdemucs_6s", description="Demucs model identifier")


class MusicDemucsSeparationResponse(BaseModel):
    """Response for Demucs-based music source separation"""
    status: str
    job_id: str
    model_name: str
    sample_rate: int
    components: List[SeparatedComponent]
    processing_time: float


class MusicSettingsSchema(BaseModel):
    """Settings schema for music mode"""
    mode: str = "music"
    instruments: List[InstrumentConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
