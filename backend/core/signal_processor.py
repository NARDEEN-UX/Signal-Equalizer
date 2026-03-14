"""
Core signal processing utilities used by all modes
"""

import numpy as np
from scipy import signal as scipy_signal
from scipy.fft import fft, fftfreq
import pywt


class SignalProcessor:
    """Base class for all signal processing operations"""
    
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
    
    @staticmethod
    def apply_fft_equalization(signal_data, frequencies, gains):
        """
        Apply FFT-based equalization to a signal
        
        Args:
            signal_data: Input signal array
            frequencies: Frequency bands (list of [low, high] pairs)
            gains: Gain values for each band (0-2)
            
        Returns:
            Equalized signal
        """
        # Compute FFT
        fft_data = fft(signal_data)
        freqs = fftfreq(len(signal_data), 1.0 / 44100)
        
        # Apply gain to each frequency band
        for (low, high), gain in zip(frequencies, gains):
            mask = (np.abs(freqs) >= low) & (np.abs(freqs) < high)
            fft_data[mask] *= gain
        
        # Inverse FFT
        equalized = np.real(np.fft.ifft(fft_data))
        return equalized
    
    @staticmethod
    def apply_wavelet_equalization(signal_data, wavelet='db4', level=6, gains=None):
        """
        Apply wavelet-based equalization
        
        Args:
            signal_data: Input signal
            wavelet: Wavelet name (db4, db8, sym5, etc.)
            level: Decomposition level
            gains: Gain array for each level
            
        Returns:
            Reconstructed signal with equalization applied
        """
        # Perform wavelet decomposition
        coeffs = pywt.wavedec(signal_data, wavelet, level=level)
        
        if gains is None:
            gains = [1.0] * len(coeffs)
        
        # Apply gains
        for i in range(len(coeffs)):
            if i < len(gains):
                coeffs[i] = coeffs[i] * gains[i]
        
        # Reconstruct
        reconstructed = pywt.waverec(coeffs, wavelet)
        return reconstructed[:len(signal_data)]
    
    @staticmethod
    def compute_fft(signal_data, sample_rate=44100):
        """Compute FFT of signal"""
        fft_vals = fft(signal_data)
        freqs = fftfreq(len(signal_data), 1.0 / sample_rate)
        magnitudes = np.abs(fft_vals)
        
        # Return only positive frequencies
        positive_freq_idx = freqs > 0
        return freqs[positive_freq_idx], magnitudes[positive_freq_idx]
    
    @staticmethod
    def compute_spectrogram(signal_data, sample_rate=44100):
        """Compute spectrogram of signal"""
        f, t, Sxx = scipy_signal.spectrogram(signal_data, sample_rate)
        return f, t, 10 * np.log10(Sxx + 1e-10)  # Convert to dB


class AudiogramScale:
    """Audiogram frequency scale conversion"""
    
    # Standard audiogram frequencies in Hz
    AUDIOGRAM_FREQS = [125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    
    @staticmethod
    def hz_to_audiogram(hz):
        """Convert Hz to nearest audiogram frequency"""
        closest = min(AudiogramScale.AUDIOGRAM_FREQS, key=lambda x: abs(x - hz))
        return closest
    
    @staticmethod
    def get_audiogram_mapping():
        """Get mapping of linear frequencies to audiogram scale"""
        return AudiogramScale.AUDIOGRAM_FREQS


class BandProcessor:
    """Process frequency bands for different modes"""
    
    @staticmethod
    def create_band_gains(bands, num_sliders):
        """
        Create gain array from band definitions
        
        Args:
            bands: List of band dicts with 'low', 'high', 'gain'
            num_sliders: Number of sliders (for non-generic modes)
            
        Returns:
            Array of gains matching slider configuration
        """
        gains = np.ones(num_sliders)
        for i, band in enumerate(bands[:num_sliders]):
            gains[i] = band.get('gain', 1.0)
        return gains
    
    @staticmethod
    def validate_band_config(bands, max_freq=20000):
        """Validate band configuration"""
        for band in bands:
            low, high = band.get('low', 0), band.get('high', 1000)
            if low < 0 or high > max_freq or low >= high:
                return False
        return True
