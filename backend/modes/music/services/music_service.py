"""
Music Mode Service
Handles musical instrument separation and equalization
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Optional, Tuple


class MusicModeService:
    """Service for music mode signal processing"""
    
    # Predefined instrument frequency ranges
    INSTRUMENT_RANGES = {
        "Bass": [(20, 250)],
        "Piano": [(27, 4186)],
        "Vocals": [(80, 8000)],
        "Violin": [(196, 3520)],
        "Drums": [(20, 10000)],
        "Guitar": [(82, 3520)],
        "Flute": [(262, 3951)],
        "Trumpet": [(165, 2349)]
    }
    
    def __init__(self):
        self.sample_rate = 44100
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        instrument_names: List[str]
    ) -> dict:
        """
        Process signal with instrument-based equalization
        
        Args:
            signal: Input signal array
            gains: Gain values for each instrument (0-2)
            instrument_names: Names of instruments being controlled
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        
        # Build frequency ranges from instrument names
        freq_ranges = self._get_frequency_ranges(instrument_names)
        
        # Apply equalization
        equalized_signal = self._apply_instrument_equalization(signal, freq_ranges, gains)
        
        # Compute analysis
        output_fft = self._compute_fft_data(equalized_signal)
        output_spectrogram = self._compute_spectrogram_data(equalized_signal)
        
        processing_time = time.time() - start_time
        
        return {
            "signal": equalized_signal.tolist(),
            "fft": output_fft,
            "spectrogram": output_spectrogram,
            "processing_time": processing_time
        }
    
    def _get_frequency_ranges(self, instrument_names: List[str]) -> List[Tuple[float, float]]:
        """Get frequency ranges for instruments"""
        ranges = []
        for name in instrument_names:
            if name in self.INSTRUMENT_RANGES:
                # Take the overall range of all sub-ranges
                sub_ranges = self.INSTRUMENT_RANGES[name]
                min_freq = min(r[0] for r in sub_ranges)
                max_freq = max(r[1] for r in sub_ranges)
                ranges.append((min_freq, max_freq))
            else:
                # Default range if instrument not found
                ranges.append((20, 20000))
        return ranges
    
    def _apply_instrument_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[Tuple[float, float]],
        gains: List[float]
    ) -> np.ndarray:
        """Apply equalization based on instrument frequency ranges"""
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / self.sample_rate)
        
        for freq_range, gain in zip(freq_ranges, gains):
            low, high = freq_range
            mask = (np.abs(freqs) >= low) & (np.abs(freqs) < high)
            fft_data[mask] *= gain
        
        equalized = np.real(np.fft.ifft(fft_data))
        return equalized
    
    def _compute_fft_data(self, signal: np.ndarray) -> dict:
        """Compute FFT for output signal"""
        fft_vals = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / self.sample_rate)
        magnitudes = np.abs(fft_vals)
        
        positive_idx = freqs > 0
        pos_freqs = freqs[positive_idx]
        pos_mags = magnitudes[positive_idx]
        
        step = max(1, len(pos_freqs) // 1000)
        
        return {
            "frequencies": pos_freqs[::step].tolist(),
            "magnitudes": pos_mags[::step].tolist()
        }
    
    def _compute_spectrogram_data(self, signal: np.ndarray) -> dict:
        """Compute spectrogram for output signal"""
        from scipy.signal import spectrogram
        f, t, Sxx = spectrogram(signal, self.sample_rate, nperseg=1024)
        Sxx_db = 10 * np.log10(Sxx + 1e-10)
        
        return {
            "frequencies": f.tolist(),
            "times": t.tolist(),
            "magnitude": (Sxx_db[::max(1, len(Sxx_db)//100), ::max(1, len(Sxx_db[0])//100)]).tolist()
        }


# Singleton instance
music_service = MusicModeService()
