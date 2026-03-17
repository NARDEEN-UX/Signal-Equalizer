"""
Schemas for Animal Sounds Mode
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class AnimalSoundConfig(BaseModel):
    """Configuration for an animal sound"""
    name: str
    freq_ranges: List[tuple] = Field(description="List of (low, high) frequency ranges")
    gain: float = Field(ge=0, le=2, default=1.0)


class AnimalsModeRequest(BaseModel):
    """Request for animals mode processing"""
    signal: List[float]
    sample_rate: int = 44100
    gains: List[float] = Field(description="Gains for each animal sound (0-2)")
    animal_names: List[str] = Field(description="Names of animal sounds")
    method: str = "fft"
    sliders_wavelet: Optional[List[float]] = None
    wavelet: str = "db4"
    wavelet_level: int = 6


class AnimalsModeResponse(BaseModel):
    """Response from animals mode processing"""
    status: str
    output_signal: List[float]
    input_fft: Optional[dict] = None
    output_fft: Optional[dict] = None
    input_spectrogram: Optional[dict] = None
    output_spectrogram: Optional[dict] = None
    input_coeffs: Optional[List[List[float]]] = None
    output_coeffs: Optional[List[List[float]]] = None
    processing_time: float


class AnimalsSettingsSchema(BaseModel):
    """Settings schema for animals mode"""
    mode: str = "animals"
    animals: List[AnimalSoundConfig]
    wavelet: str = "db4"
    wavelet_level: int = 6
    description: Optional[str] = None
