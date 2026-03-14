"""
Schemas for Generic Mode
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class BandConfig(BaseModel):
    """Configuration for a single frequency band"""
    id: str
    name: str
    low: float = Field(ge=0, description="Lower frequency bound in Hz")
    high: float = Field(gt=0, description="Upper frequency bound in Hz")
    gain: float = Field(ge=0, le=2, default=1.0, description="Gain multiplier (0-2)")


class GenericModeRequest(BaseModel):
    """Request for generic mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    bands: List[BandConfig]
    sliders_wavelet: Optional[List[float]] = None
    wavelet: str = "db4"
    wavelet_level: int = 6


class GenericModeResponse(BaseModel):
    """Response from generic mode processing"""
    status: str
    output_signal: List[float]
    output_fft: Optional[dict] = None
    output_spectrogram: Optional[dict] = None
    processing_time: float


class GenericSettingsSchema(BaseModel):
    """Settings schema for generic mode"""
    mode: str = "generic"
    bands: List[BandConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
    created_at: Optional[str] = None
