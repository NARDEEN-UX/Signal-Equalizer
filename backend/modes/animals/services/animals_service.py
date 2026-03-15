"""
Animals Mode Service
Handles animal sound separation and equalization
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple


class AnimalsModeService:
    """Service for animals mode signal processing"""
    
    # Predefined animal sound frequency ranges
    ANIMAL_RANGES = {
        "Cat": [(50, 10000)],  # Meows and purrs
        "Dog": [(40, 8000)],   # Barks and howls
        "Bird": [(200, 8000)], # Chirps and songs
        "Elephant": [(10, 5000)],  # Low frequency calls
        "Lion": [(40, 2000)],  # Roars
        "Sheep": [(300, 3000)],  # Bleats
        "Cow": [(50, 2000)],   # Moos
        "Horse": [(60, 2000)], # Neighs and whinnies
        "Monkey": [(100, 5000)],   # Calls
        "Frog": [(50, 8000)]   # Croaks
    }
    
    def __init__(self):
        self.sample_rate = 44100
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        animal_names: List[str]
    ) -> dict:
        """
        Process signal with animal sound-based equalization
        
        Args:
            signal: Input signal array
            gains: Gain values for each animal sound (0-2)
            animal_names: Names of animal sounds being controlled
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        
        # Build frequency ranges from animal names
        freq_ranges = self._get_frequency_ranges(animal_names)
        
        # Apply equalization
        equalized_signal = self._apply_animal_equalization(signal, freq_ranges, gains)
        
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
    
    def _get_frequency_ranges(self, animal_names: List[str]) -> List[Tuple[float, float]]:
        """Get frequency ranges for animal sounds"""
        ranges = []
        for name in animal_names:
            if name in self.ANIMAL_RANGES:
                sub_ranges = self.ANIMAL_RANGES[name]
                min_freq = min(r[0] for r in sub_ranges)
                max_freq = max(r[1] for r in sub_ranges)
                ranges.append((min_freq, max_freq))
            else:
                ranges.append((20, 20000))
        return ranges
    
    def _apply_animal_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[Tuple[float, float]],
        gains: List[float]
    ) -> np.ndarray:
        """Apply equalization based on animal sound frequency ranges"""
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
animals_service = AnimalsModeService()
