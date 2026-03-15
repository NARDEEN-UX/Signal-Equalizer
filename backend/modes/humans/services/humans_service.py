"""
Humans Mode Service
Handles human voice separation and equalization
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple


class HumansModeService:
    """Service for humans mode signal processing"""
    
    # Voice characteristic frequency ranges
    VOICE_RANGES = {
        # Gender-based ranges
        "Male": [(85, 255)],       # Male fundamental frequency range
        "Female": [(165, 255)],    # Female fundamental frequency range
        "Young": [(200, 8000)],    # Young voices have higher harmonics
        "Old": [(80, 4000)],       # Old voices have lower frequencies
        
        # Language-specific characteristics (approximate formant regions)
        "Arabic": [(100, 8000)],   # Arabic speech
        "English": [(85, 12000)],  # English speech
        "Spanish": [(85, 10000)],  # Spanish speech
        "French": [(85, 10000)],   # French speech
        "German": [(80, 9000)],    # German speech
        "Chinese": [(100, 8000)],  # Tonal language
        
        # Mixed descriptors
        "Child": [(200, 15000)],   # High pitched children
        "Adult": [(85, 8000)],     # Standard adult speech
    }
    
    def __init__(self):
        self.default_sample_rate = 44100
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        voice_names: List[str],
        sample_rate: float = None
    ) -> dict:
        """
        Process signal with human voice-based equalization
        
        Args:
            signal: Input signal array
            gains: Gain values for each voice (0-2)
            voice_names: Descriptions/names of voices
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)
        
        # Build frequency ranges from voice names
        freq_ranges = self._get_frequency_ranges(voice_names)

        # Compute input analysis for accurate A/B visualization.
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        # Apply equalization
        equalized_signal = self._apply_voice_equalization(signal, freq_ranges, gains, sr)
        
        # Compute analysis
        output_fft = self._compute_fft_data(equalized_signal, sr)
        output_spectrogram = self._compute_spectrogram_data(equalized_signal, sr)
        
        processing_time = time.time() - start_time
        
        return {
            "signal": equalized_signal.tolist(),
            "fft": output_fft,
            "input_spectrogram": input_spectrogram,
            "spectrogram": output_spectrogram,
            "processing_time": processing_time
        }
    
    def _get_frequency_ranges(self, voice_names: List[str]) -> List[Tuple[float, float]]:
        """Get frequency ranges for voice types"""
        ranges = []
        for name in voice_names:
            if name in self.VOICE_RANGES:
                sub_ranges = self.VOICE_RANGES[name]
                min_freq = min(r[0] for r in sub_ranges)
                max_freq = max(r[1] for r in sub_ranges)
                ranges.append((min_freq, max_freq))
            else:
                ranges.append((80, 8000))
        return ranges
    
    def _apply_voice_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[Tuple[float, float]],
        gains: List[float],
        sample_rate: float
    ) -> np.ndarray:
        """Apply equalization based on voice frequency ranges"""
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        
        for freq_range, gain in zip(freq_ranges, gains):
            low, high = freq_range
            mask = (np.abs(freqs) >= low) & (np.abs(freqs) < high)
            fft_data[mask] *= gain
        
        equalized = np.real(np.fft.ifft(fft_data))
        return equalized
    
    def _compute_fft_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """Compute FFT for output signal"""
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
        """Compute spectrogram for output signal"""
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
humans_service = HumansModeService()
