"""
Music Mode Service
Handles musical instrument separation and equalization

Updated to support configurable frequency bands from music_default.json
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Optional, Tuple, Dict
import pywt


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

    # Music-mode mapping requested by product spec for 6-level decomposition.
    # Levels are detail bands L1..L6 where L1 is highest-frequency detail.
    INSTRUMENT_LEVEL_MAP = {
        "Bass": [5, 6],
        "Piano": [3, 4],
        "Vocals": [3, 4, 5],
        "Violin": [3, 4]
    }

    ALLOWED_WAVELETS = {
        "haar", "db4", "db6", "db8", "sym5", "sym8", "coif3", "bior3.5", "dmey"
    }
    
    def __init__(self):
        self.default_sample_rate = 44100
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        instrument_names: List[str],
        sample_rate: float = None,
        bands: Optional[List[Dict]] = None,
        wavelet: str = "db4",
        wavelet_level: int = 6,
        sliders_wavelet: Optional[List[float]] = None,
        wavelet_gains: Optional[Dict[str, float]] = None
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
        
        # Compute input analysis for accurate A/B visualization.
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        # Wavelet coefficient decomposition for visualization and level-domain gain mapping.
        wavelet_name = self._validate_wavelet(wavelet)
        level = max(1, min(int(wavelet_level or 6), 6))
        input_coeffs, output_coeffs, equalized_signal = self._compute_music_wavelet_coeffs(
            signal=signal,
            instrument_names=instrument_names,
            gains=gains,
            wavelet=wavelet_name,
            level=level,
            sliders_wavelet=sliders_wavelet,
            wavelet_gains=wavelet_gains
        )

        if equalized_signal.size:
            print(
                "[wavelet] output signal range before return:",
                {"min": float(np.min(equalized_signal)), "max": float(np.max(equalized_signal))}
            )
        
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
            "input_coeffs": input_coeffs,
            "output_coeffs": output_coeffs,
            "processing_time": processing_time
        }

    def _validate_wavelet(self, wavelet: str) -> str:
        key = str(wavelet or "db4").strip().lower()
        if key not in self.ALLOWED_WAVELETS:
            raise ValueError(
                f"Unsupported wavelet '{wavelet}'. Allowed: {sorted(self.ALLOWED_WAVELETS)}"
            )
        return key

    def _detail_index_for_level(self, level: int, target_level: int) -> int:
        # pywt.wavedec layout for level=N: [cA_N, cD_N, cD_{N-1}, ..., cD_1]
        # L1 maps to cD_1, L6 maps to cD_6.
        return level - target_level + 1

    def _compute_level_gains(self, instrument_names: List[str], gains: List[float], level: int) -> List[float]:
        level_gains = [1.0] * (level + 1)  # index 0 unused for cA; details are 1..level

        for name, gain in zip(instrument_names, gains):
            instrument = str(name or "").strip()
            # "Others" is intentionally neutral (1.0) across all levels.
            if instrument == "Others":
                continue
            mapped = self.INSTRUMENT_LEVEL_MAP.get(instrument, [])
            g = float(gain)
            for lv in mapped:
                if 1 <= lv <= level:
                    level_gains[lv] *= g

        return level_gains

    def _compute_music_wavelet_coeffs(
        self,
        signal: np.ndarray,
        instrument_names: List[str],
        gains: List[float],
        wavelet: str,
        level: int,
        sliders_wavelet: Optional[List[float]] = None,
        wavelet_gains: Optional[Dict[str, float]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray]:
        coeffs = pywt.wavedec(signal, wavelet, level=level)
        # Keep full coefficient arrays for each detail level L1..L{level}.
        input_detail_coeffs = []

        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            input_detail_coeffs.append(coeffs[idx].tolist())

        if isinstance(wavelet_gains, dict) and wavelet_gains:
            level_gains = [1.0] * (level + 1)
            for lv in range(1, level + 1):
                key = f"L{lv}"
                g = wavelet_gains.get(key, 1.0)
                level_gains[lv] = max(0.0, min(2.0, float(g)))
        else:
            level_gains = self._compute_level_gains(instrument_names, gains, level)

        # Apply explicit per-level gain sliders (L1..L6) on top of instrument mapping.
        if sliders_wavelet:
            for lv in range(1, level + 1):
                if lv - 1 < len(sliders_wavelet):
                    s = float(sliders_wavelet[lv - 1])
                    level_gains[lv] *= max(0.0, min(2.0, s))
        out_coeffs = [np.array(c, copy=True) for c in coeffs]

        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            out_coeffs[idx] = out_coeffs[idx] * level_gains[lv]

        output_detail_coeffs = []
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            output_detail_coeffs.append(out_coeffs[idx].tolist())

        coeff_debug = []
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            in_arr = np.asarray(coeffs[idx], dtype=float)
            out_arr = np.asarray(out_coeffs[idx], dtype=float)
            in_max = float(np.max(np.abs(in_arr))) if in_arr.size else 0.0
            out_max = float(np.max(np.abs(out_arr))) if out_arr.size else 0.0
            ratio = (out_max / in_max) if in_max > 0 else float('inf')
            coeff_debug.append({
                "level": f"L{lv}",
                "input_max": in_max,
                "output_max": out_max,
                "ratio": ratio,
                "applied_gain": float(level_gains[lv])
            })
        print("[wavelet] coeff max debug:", coeff_debug)

        reconstructed = pywt.waverec(out_coeffs, wavelet)
        reconstructed = np.asarray(reconstructed[:len(signal)], dtype=float)

        return input_detail_coeffs, output_detail_coeffs, reconstructed
    
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
