"""
Core Pydantic schemas
"""
from pydantic import BaseModel
from typing import List, Tuple

class FrequencyBand(BaseModel):
    low_freq: float
    high_freq: float

class EqualizationRequest(BaseModel):
    scales: List[float]
    use_wavelet: bool = False
    wavelet_type: str = 'db4'

class EqualizationResponse(BaseModel):
    message: str
    output_signal: List[float] = None
    output_fft_freqs: List[float] = None
    output_fft_magnitude: List[float] = None
    output_spectrogram_freqs: List[float] = None
    output_spectrogram_times: List[float] = None
    output_spectrogram_power: List[List[float]] = None

class ModeInfoResponse(BaseModel):
    name: str
    num_sliders: int
    slider_labels: List[str]
    freq_bands: List[Tuple[float, float]] = None
    wavelet: str = None
    wavelet_levels: int = None
    requirements: List[str] = None

class SettingsModel(BaseModel):
    mode: str
    freq_bands: List[Tuple[float, float]]
    slider_labels: List[str]
    wavelet: str = 'db4'
    wavelet_levels: int = 5
