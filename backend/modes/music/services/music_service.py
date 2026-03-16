"""
Music Mode Service
Handles musical instrument separation and equalization

Updated to support configurable frequency bands from music_default.json
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Optional, Tuple, Dict


class MusicModeService:
    """Service for music mode signal processing with configurable bands"""
    
    # Default instrument frequency ranges (used as fallback)
    INSTRUMENT_RANGES = {
        "Bass": [(20, 250)],
        "Piano": [(27, 4186)],
        "Vocals": [(80, 8000)],
        "Violin": [(196, 3520)],
        "Drums": [(20, 10000)],
        "Guitar": [(82, 3520)],
        "Flute": [(262, 3951)],
        "Trumpet": [(165, 2349)],
        "Others": [(20, 20000)]
    }
    
    def __init__(self):
        self.default_sample_rate = 44100
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        instrument_names: List[str],
        sample_rate: float = None,
        bands: Optional[List[Dict]] = None
    ) -> dict:
        """
        Process signal with instrument-based equalization
        
        Args:
            signal: Input signal array
            gains: Gain values for each instrument (0-2)
            instrument_names: Names of instruments being controlled
            sample_rate: Sample rate of the signal
            bands: Optional list of band configurations with frequency ranges
                   Format: [{"id": str, "name": str, "low": float, "high": float, "gain": float}, ...]
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)
        
        # Use provided bands if available, otherwise build from instrument names
        freq_ranges = self._get_frequency_ranges_from_bands(bands) if bands else self._get_frequency_ranges(instrument_names)

        # Compute input analysis for accurate A/B visualization.
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        # Apply equalization using gains and frequency ranges
        equalized_signal = self._apply_instrument_equalization(signal, freq_ranges, gains, sr)
        
        # Compute analysis
        output_fft = self._compute_fft_data(equalized_signal, sr)
        output_spectrogram = self._compute_spectrogram_data(equalized_signal, sr)
        
        processing_time = time.time() - start_time
        
        return {
            "signal": equalized_signal.tolist(),
            "input_fft": input_fft,
            "fft": output_fft,
            "input_spectrogram": input_spectrogram,
            "spectrogram": output_spectrogram,
            "processing_time": processing_time
        }
    
    def _get_frequency_ranges_from_bands(self, bands: List[Dict]) -> List[Tuple[float, float]]:
        """
        Extract frequency ranges from band configuration objects
        
        Args:
            bands: List of band objects with 'low' and 'high' frequency fields
            
        Returns:
            List of (low, high) frequency tuples
        """
        ranges = []
        for band in bands:
            if isinstance(band, dict) and 'low' in band and 'high' in band:
                low = float(band.get('low', 20))
                high = float(band.get('high', 20000))
                ranges.append((low, high))
            else:
                # Default fallback
                ranges.append((20, 20000))
        return ranges
    
    def _get_frequency_ranges(self, instrument_names: List[str]) -> List[Tuple[float, float]]:
        """
        Get frequency ranges for instruments by name lookup
        
        Args:
            instrument_names: Names of instruments to look up
            
        Returns:
            List of (low, high) frequency tuples
        """
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
        gains: List[float],
        sample_rate: float
    ) -> np.ndarray:
        """
        Apply equalization based on instrument frequency ranges
        
        Args:
            signal: Input signal
            freq_ranges: List of (low_freq, high_freq) tuples
            gains: Gain values corresponding to each frequency range
            sample_rate: Sample rate of the signal
            
        Returns:
            Equalized signal
        """
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        
        for freq_range, gain in zip(freq_ranges, gains):
            low, high = freq_range
            mask = (np.abs(freqs) >= low) & (np.abs(freqs) < high)
            fft_data[mask] *= gain
        
        equalized = np.real(np.fft.ifft(fft_data))
        return equalized
    
    def _compute_fft_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """
        Compute FFT for output signal
        
        Args:
            signal: Input signal
            sample_rate: Sample rate
            
        Returns:
            Dictionary with frequencies and magnitudes
        """
        fft_vals = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        magnitudes = np.abs(fft_vals)
        
        positive_idx = freqs > 0
        pos_freqs = freqs[positive_idx]
        pos_mags = magnitudes[positive_idx]
        
        step = max(1, len(pos_freqs) // 1000)
        
        return {
            "frequencies": pos_freqs[::step].tolist(),
            "magnitudes": pos_mags[::step].tolist()
        }
    
    def _compute_spectrogram_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """
        Compute spectrogram for output signal
        
        Args:
            signal: Input signal
            sample_rate: Sample rate
            
        Returns:
            Dictionary with time, frequency, and magnitude data
        """
        from scipy.signal import spectrogram
        f, t, Sxx = spectrogram(
            signal,
            sample_rate,
            window='hann',
            nperseg=1024,
            noverlap=768,
            scaling='spectrum',
            mode='psd'
        )

        ref = max(float(np.max(Sxx)), 1e-12)
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12) / ref)
        Sxx_db = np.maximum(Sxx_db, -80.0)

        freq_step = max(1, len(f) // 100)
        time_step = max(1, len(t) // 100)
        f_ds = f[::freq_step]
        t_ds = t[::time_step]
        Sxx_ds = Sxx_db[::freq_step, ::time_step]
        
        return {
            "frequencies": f_ds.tolist(),
            "times": t_ds.tolist(),
            "magnitude": Sxx_ds.tolist()
        }


# Singleton instance
music_service = MusicModeService()
