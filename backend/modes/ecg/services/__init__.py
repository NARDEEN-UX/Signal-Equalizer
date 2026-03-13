"""ECG mode services"""
from typing import List
from core.dsp import apply_freq_equalization, apply_wavelet_equalization, compute_fft, compute_spectrogram
from core.config import get_mode_config
import numpy as np

class ECGModeService:
    def __init__(self):
        self.config = get_mode_config('ecg')
        self.sample_rate = 250  # Typical for ECG
        self.freq_bands = self.config['freq_bands']
        self.slider_labels = self.config['slider_labels']
    
    def process_signal(self, signal_data: np.ndarray, scales: List[float], 
                      use_wavelet: bool = False, wavelet_type: str = 'db4'):
        """Process signal with ECG mode equalization"""
        if use_wavelet:
            # Wavelet-based processing
            output_signal = apply_wavelet_equalization(signal_data, scales, wavelet_type, 
                                                       level=self.config['wavelet_levels'])
        else:
            # FFT-based processing
            output_signal = apply_freq_equalization(signal_data, self.freq_bands, scales, 
                                                   self.sample_rate)
        
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
        """Get ECG mode information"""
        return {
            'name': self.config['name'],
            'num_sliders': self.config['num_sliders'],
            'slider_labels': self.config['slider_labels'],
            'freq_bands': self.config['freq_bands'],
            'wavelet': self.config['wavelet'],
            'wavelet_levels': self.config['wavelet_levels'],
            'requirements': self.config.get('requirements', [])
        }
