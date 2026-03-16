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


class HumansModeRequest(BaseModel):
    """Request for humans mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    gains: List[float] = Field(description="Gains for each human voice (0-2)")
    voice_names: List[str] = Field(description="Names/descriptions of voices")
    custom_freq_ranges: Optional[List[tuple]] = None
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
    processing_time: float


class HumansSettingsSchema(BaseModel):
    """Settings schema for humans mode"""
    mode: str = "humans"
    voices: List[HumanVoiceConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
