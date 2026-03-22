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
    
    # Exact Fundamental Frequency Ranges (in Hz)
    INSTRUMENT_RANGES = {
        "Bass": [(40, 400)],          # Bass string fundamentals 41Hz - ~400Hz
        "Piano": [(27.5, 4186)],      # Full 88-key piano range A0 - C8
        "Vocals": [(85, 1100)],       # Male Bass (85Hz) to Female Soprano (1100Hz)
        "Violin": [(196, 3520)],      # G3 (196Hz) to A7 (3520Hz)
        "Drums": [(50, 250)],         # Kicks (50-90Hz), Snares/Toms (100-250Hz)
        "Guitar": [(82, 1175)],       # Low E (82Hz) to high frets ~1kHz
        "Flute": [(261, 2349)],       # C4 (261Hz) to D7 (2349Hz)
        "Trumpet": [(164, 987)],      # E3 (164Hz) to B5 (987Hz)
        "Others": [(20, 20000)]
    }

    # Music-mode mapping for 10-level decomposition at 44.1kHz.
    # L1: 11k-22k, L2: 5.5k-11k, L3: 2.7k-5.5k, L4: 1.3k-2.7k, L5: 689-1.3k
    # L6: 344-689, L7: 172-344, L8: 86-172, L9: 43-86, L10: 21.5-43, A10: 0-21.5
    # 0 maps to Approximation (A10)
    INSTRUMENT_LEVEL_MAP = {
        "Bass": [7, 8, 9, 10],            # 43 - 344 Hz
        "Piano": [3, 4, 5, 6, 7, 8, 9, 10, 0], # 0 - 5.5k Hz
        "Vocals": [5, 6, 7, 8, 9],        # 43 - 1.3k Hz
        "Violin": [3, 4, 5, 6, 7],        # 172 - 5.5k Hz
        "Drums": [7, 8, 9],               # 43 - 344 Hz (Fundamentals)
        "Guitar": [4, 5, 6, 7, 8],        # 86 - 2.7k Hz
        "Flute": [4, 5, 6, 7],            # 172 - 2.7k Hz
        "Trumpet": [5, 6, 7, 8]           # 86 - 1.3k Hz
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
        method: str = "wavelet",
        wavelet: str = "db4",
        wavelet_level: int = 6,
        sliders_wavelet: Optional[List[float]] = None
    ) -> dict:
        """
        Process signal with instrument-based equalization
        
        Args:
            signal: Input signal array
            gains: Gain values for each instrument (0-2)
            instrument_names: Names of instruments being controlled
            sample_rate: Sample rate of the signal
            bands: Optional list of band configurations with frequency ranges
            method: 'fft' or 'wavelet'
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)
        
        # Compute input analysis for accurate A/B visualization.
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        input_coeffs = None
        output_coeffs = None
        
        if method == "fft":
            # FFT path
            freq_ranges = self._get_frequency_ranges(instrument_names)
            equalized_signal = self._apply_instrument_equalization(signal, freq_ranges, gains, sr)
        else:
            # Wavelet path
            wavelet_name = self._validate_wavelet(wavelet)
            max_level = pywt.dwt_max_level(len(signal), pywt.Wavelet(wavelet_name).dec_len)
            actual_level = max(1, min(int(wavelet_level or 6), max_level))
            freq_ranges = self._get_frequency_ranges(instrument_names)
            input_coeffs, output_coeffs, equalized_signal = self._compute_music_wavelet_coeffs(
                signal=signal,
                freq_ranges=freq_ranges,
                gains=gains,
                wavelet=wavelet_name,
                level=actual_level,
                sample_rate=sr,
                sliders_wavelet=sliders_wavelet
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

    @staticmethod
    def _clamp_gain(gain: float) -> float:
        return max(0.0, min(2.0, float(gain)))

    @staticmethod
    def _ranges_overlap(low_a: float, high_a: float, low_b: float, high_b: float) -> bool:
        return min(high_a, high_b) > max(low_a, low_b)

    @staticmethod
    def _detail_level_band(level_idx: int, sample_rate: float) -> Tuple[float, float]:
        high = sample_rate / (2 ** level_idx)
        low = sample_rate / (2 ** (level_idx + 1))
        return low, high

    def _compute_level_gains_from_ranges(
        self,
        freq_ranges: List[Tuple[float, float]],
        gains: List[float],
        level: int,
        sample_rate: float,
        sliders_wavelet: Optional[List[float]] = None
    ) -> List[float]:
        level_gains = [1.0] * (level + 1)

        for lv in range(1, level + 1):
            lv_low, lv_high = self._detail_level_band(lv, sample_rate)
            matched = []
            for (low, high), gain in zip(freq_ranges, gains):
                if self._ranges_overlap(lv_low, lv_high, float(low), float(high)):
                    matched.append(self._clamp_gain(gain))

            base_gain = float(np.mean(matched)) if matched else 1.0
            if sliders_wavelet is not None and lv - 1 < len(sliders_wavelet):
                base_gain *= self._clamp_gain(sliders_wavelet[lv - 1])

            level_gains[lv] = self._clamp_gain(base_gain)

        return level_gains

    def _compute_music_wavelet_coeffs(
        self,
        signal: np.ndarray,
        freq_ranges: List[Tuple[float, float]],
        gains: List[float],
        wavelet: str,
        level: int,
        sample_rate: float,
        sliders_wavelet: Optional[List[float]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray]:
        coeffs = pywt.wavedec(signal, wavelet, level=level)
        
        input_detail_coeffs = []
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            input_detail_coeffs.append(coeffs[idx].tolist())

        level_gains = self._compute_level_gains_from_ranges(
            freq_ranges=freq_ranges,
            gains=gains,
            level=level,
            sample_rate=sample_rate,
            sliders_wavelet=sliders_wavelet
        )
                    
        out_coeffs = [np.array(c, copy=True) for c in coeffs]

        # Keep approximation unchanged; level sliders target details L1..LN.
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            out_coeffs[idx] = out_coeffs[idx] * level_gains[lv]

        output_detail_coeffs = []
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            output_detail_coeffs.append(out_coeffs[idx].tolist())

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
