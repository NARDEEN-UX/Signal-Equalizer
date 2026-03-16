"""
Schemas for Music Mode
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class InstrumentConfig(BaseModel):
    """Configuration for a musical instrument"""
    name: str
    freq_ranges: List[tuple] = Field(description="List of (low, high) frequency ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class MusicModeRequest(BaseModel):
    """Request for music mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    gains: List[float] = Field(description="Gains for each instrument (0-2)")
    instrument_names: List[str] = Field(description="Names of instruments")
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
    processing_time: float


class MusicSettingsSchema(BaseModel):
    """Settings schema for music mode"""
    mode: str = "music"
    instruments: List[InstrumentConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
