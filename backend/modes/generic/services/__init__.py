"""Generic mode services"""
from typing import List
from core.dsp import apply_freq_equalization, apply_wavelet_equalization, compute_fft, compute_spectrogram
import numpy as np

class GenericModeService:
    def __init__(self):
        self.sample_rate = 44100
    
    def process_signal(self, signal_data: np.ndarray, freq_bands: List[tuple], 
                      scales: List[float], use_wavelet: bool = False, 
                      wavelet_type: str = 'db4'):
        """Process signal with generic mode equalization"""
        if use_wavelet:
            # Wavelet-based processing
            output_signal = apply_wavelet_equalization(signal_data, scales, wavelet_type, level=5)
        else:
            # FFT-based processing
            output_signal = apply_freq_equalization(signal_data, freq_bands, scales, self.sample_rate)
        
        # Compute FFT for output
        freqs, magnitude = compute_fft(output_signal, self.sample_rate)
        
        # Compute spectrogram for output
        f, t, Sxx = compute_spectrogram(output_signal, self.sample_rate)
        
        return {
            'signal': output_signal,
            'fft_freqs': freqs,
            'fft_magnitude': magnitude,
            'spec_freqs': f,
            'spec_times': t,
            'spec_power': Sxx
        }
    
    def get_mode_info(self):
        """Get generic mode information"""
        return {
            'name': 'Generic Mode',
            'num_sliders': 0,
            'slider_labels': [],
            'wavelet': 'db4',
            'wavelet_levels': 5
        }
