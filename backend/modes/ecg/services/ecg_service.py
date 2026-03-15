"""
ECG Mode Service
Handles ECG signal processing and arrhythmia component separation
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple


class ECGModeService:
    """Service for ECG mode signal processing"""
    
    # ECG and arrhythmia component frequency ranges
    # Normal ECG: 0.05-100 Hz
    # Arrhythmias have specific frequency characteristics
    COMPONENT_RANGES = {
        "Normal": [(0.05, 100)],           # Normal ECG waveform
        "Atrial Fibrillation": [(5, 50)],  # Irregular rapid atrial activity
        "Ventricular Tachycardia": [(3, 40)],  # Fast ventricular rhythms
        "Heart Block": [(0.5, 5)],         # Slow, irregular rhythms
        "Premature Beats": [(10, 80)],     # Early abnormal beats
        "Bradycardia": [(0.5, 3)],         # Slow heart rate (< 60 bpm)
        "Tachycardia": [(3, 10)],          # Fast heart rate (> 100 bpm)
    }
    
    def __init__(self):
        self.sample_rate = 500  # Typical ECG sampling rate is 500 Hz
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        component_names: List[str]
    ) -> dict:
        """
        Process ECG signal with arrhythmia component equalization
        
        Args:
            signal: Input ECG signal array
            gains: Gain values for each component (0-2)
            component_names: Names of ECG components
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        
        # Build frequency ranges from component names
        freq_ranges = self._get_frequency_ranges(component_names)

        # Compute input analysis for accurate A/B visualization.
        input_spectrogram = self._compute_spectrogram_data(signal)
        
        # Apply equalization
        equalized_signal = self._apply_ecg_equalization(signal, freq_ranges, gains)
        
        # Compute analysis
        output_fft = self._compute_fft_data(equalized_signal)
        output_spectrogram = self._compute_spectrogram_data(equalized_signal)
        
        processing_time = time.time() - start_time
        
        return {
            "signal": equalized_signal.tolist(),
            "fft": output_fft,
            "input_spectrogram": input_spectrogram,
            "spectrogram": output_spectrogram,
            "processing_time": processing_time
        }
    
    def _get_frequency_ranges(self, component_names: List[str]) -> List[Tuple[float, float]]:
        """Get frequency ranges for ECG components"""
        ranges = []
        for name in component_names:
            if name in self.COMPONENT_RANGES:
                sub_ranges = self.COMPONENT_RANGES[name]
                min_freq = min(r[0] for r in sub_ranges)
                max_freq = max(r[1] for r in sub_ranges)
                ranges.append((min_freq, max_freq))
            else:
                ranges.append((0.05, 100))
        return ranges
    
    def _apply_ecg_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[Tuple[float, float]],
        gains: List[float]
    ) -> np.ndarray:
        """Apply equalization based on ECG component frequency ranges"""
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
        # ECG favors shorter windows while still using standard relative dB conversion.
        f, t, Sxx = spectrogram(
            signal,
            self.sample_rate,
            window='hann',
            nperseg=256,
            noverlap=192,
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
ecg_service = ECGModeService()
