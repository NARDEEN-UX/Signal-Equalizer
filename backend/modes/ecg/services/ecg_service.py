"""
ECG Mode Service
Handles ECG signal processing and arrhythmia component separation.
Supports both FFT-based and wavelet-based (db4) equalization.
"""

import numpy as np
from scipy.fft import fft, fftfreq
from scipy.signal import spectrogram
import pywt
import time
from typing import List, Tuple


class ECGModeService:
    """Service for ECG mode signal processing"""

    # Each arrhythmia component maps to *multiple* frequency windows.
    # This satisfies the requirement that "each slider can correspond to
    # multiple frequency ranges/windows".
    COMPONENT_RANGES = {
        "Normal": [
            (0.05, 0.5),    # baseline / respiratory component
            (0.5, 5),       # P-wave and T-wave energy
            (5, 40),        # QRS complex energy
            (40, 100),      # high-frequency notching
        ],
        "Atrial Fibrillation": [
            (4, 10),        # f-wave fundamental
            (10, 30),       # f-wave harmonics
            (30, 50),       # high-frequency fibrillatory activity
        ],
        "Ventricular Tachycardia": [
            (1, 8),         # wide QRS fundamental
            (8, 25),        # QRS harmonic content
            (25, 40),       # high-frequency VT morphology
        ],
        "Heart Block": [
            (0.1, 0.5),     # very low freq baseline wander
            (0.5, 3),       # dropped-beat / pausing component
            (3, 5),         # abnormal P-wave timing
        ],
    }

    def __init__(self):
        self.sample_rate = 500  # typical ECG sampling rate

    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        component_names: List[str],
        wavelet: str = "db4",
        wavelet_level: int = 6,
        sliders_wavelet: List[float] = None,
    ) -> dict:
        start_time = time.time()

        freq_ranges = self._get_frequency_ranges(component_names)

        # FFT equalization
        equalized_signal = self._apply_ecg_equalization(signal, freq_ranges, gains)

        # Optional wavelet equalization on top
        if sliders_wavelet is not None:
            equalized_signal = self._apply_wavelet_equalization(
                equalized_signal, wavelet, wavelet_level, sliders_wavelet
            )

        output_fft = self._compute_fft_data(equalized_signal)
        output_spectrogram = self._compute_spectrogram_data(equalized_signal)

        return {
            "signal": equalized_signal.tolist(),
            "fft": output_fft,
            "spectrogram": output_spectrogram,
            "processing_time": time.time() - start_time,
        }

    # ── frequency helpers ──────────────────────────────────────────────

    def _get_frequency_ranges(
        self, component_names: List[str]
    ) -> List[List[Tuple[float, float]]]:
        """Return list-of-lists: each component gets its full list of sub-ranges."""
        ranges = []
        for name in component_names:
            if name in self.COMPONENT_RANGES:
                ranges.append(self.COMPONENT_RANGES[name])
            else:
                ranges.append([(0.05, 100)])
        return ranges

    def _apply_ecg_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[List[Tuple[float, float]]],
        gains: List[float],
    ) -> np.ndarray:
        """Apply gain across *all* sub-ranges for each component."""
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / self.sample_rate)

        for sub_ranges, gain in zip(freq_ranges, gains):
            for low, high in sub_ranges:
                mask = (np.abs(freqs) >= low) & (np.abs(freqs) < high)
                fft_data[mask] *= gain

        return np.real(np.fft.ifft(fft_data))

    # ── wavelet equalization ───────────────────────────────────────────

    def _apply_wavelet_equalization(
        self,
        signal: np.ndarray,
        wavelet: str,
        level: int,
        gains: List[float],
    ) -> np.ndarray:
        """Wavelet decomposition → scale coefficients → reconstruct."""
        coeffs = pywt.wavedec(signal, wavelet, level=level)
        for i in range(len(coeffs)):
            if i < len(gains):
                coeffs[i] = coeffs[i] * gains[i]
        return pywt.waverec(coeffs, wavelet)[: len(signal)]

    # ── analysis outputs ───────────────────────────────────────────────

    def _compute_fft_data(self, signal: np.ndarray) -> dict:
        fft_vals = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / self.sample_rate)
        magnitudes = np.abs(fft_vals)

        positive_idx = freqs > 0
        pos_freqs = freqs[positive_idx]
        pos_mags = magnitudes[positive_idx]

        step = max(1, len(pos_freqs) // 1000)
        return {
            "frequencies": pos_freqs[::step].tolist(),
            "magnitudes": pos_mags[::step].tolist(),
        }

    def _compute_spectrogram_data(self, signal: np.ndarray) -> dict:
        nperseg = min(256, len(signal))
        f, t, Sxx = spectrogram(signal, self.sample_rate, nperseg=nperseg)
        Sxx_db = 10 * np.log10(Sxx + 1e-10)

        row_step = max(1, len(Sxx_db) // 100)
        col_step = max(1, Sxx_db.shape[1] // 100) if Sxx_db.ndim > 1 else 1
        return {
            "frequencies": f.tolist(),
            "times": t.tolist(),
            "magnitude": Sxx_db[::row_step, ::col_step].tolist(),
        }


ecg_service = ECGModeService()
