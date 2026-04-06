import numpy as np
from scipy import signal
import json
import time
from typing import List, Tuple, Optional, Dict, Any
import pywt
from scipy.fft import fft, fftfreq


class AnimalModeSeparator:
    """
    Separate animal sounds using frequency-based decomposition
    Supports 4 user-defined species categories
    """
    
    # 4-band animal configuration using requested estimated ranges.
    ANIMAL_RANGES = {
        'frog': {
            'id': 'animal-0',
            'name': 'Frog',
            'low': 225,
            'high': 504,
            'gain': 1.0
        },
        'birds': {
            'id': 'animal-1',
            'name': 'Birds',
            'low': 4255,
            'high': 11025,
            'gain': 1.0
        },
        'dog': {
            'id': 'animal-2',
            'name': 'Dog',
            'low': 504,
            'high': 1943,
            'gain': 1.0
        },
        'cat': {
            'id': 'animal-3',
            'name': 'Cat',
            'low': 1943,
            'high': 4255,
            'gain': 1.0
        }
    }
    
    # 7-level Animal Configuration at 44.1kHz (FULL FREQUENCY COVERAGE)
    # L1: 11025-22050 Hz (Birds highest)
    # L2: 5512-11025 Hz (Birds + Cat high)
    # L3: 2756-5512 Hz (Cat)
    # L4: 1378-2756 Hz (Cat + Dog)
    # L5: 689-1378 Hz (Dog)
    # L6: 344.5-689 Hz (Dog + Frog)
    # L7: 172.25-344.5 Hz (Frog lower)
    # cA: 0-172.25 Hz (Frog lowest + approximation)
    ANIMAL_LEVEL_MAP = {
        "frog": [6, 7, "cA"],     # Frog: 225-504 Hz → L6,L7,cA (344-689 + 172-344 + 0-172)
        "birds": [1, 2, 3],        # Birds: 4255-11025 Hz → L1,L2,L3 (11025-22050 + 5512-11025 + 2756-5512)
        "dog": [4, 5, 6],          # Dog: 504-1943 Hz → L4,L5,L6 (1378-2756 + 689-1378 + 344-689)
        "cat": [2, 3, 4]           # Cat: 1943-4255 Hz → L2,L3,L4 (5512-11025 + 2756-5512 + 1378-2756)
    }

    def __init__(self, sample_rate=44100):
        """
        Initialize animal mode separator
        """
        self.sample_rate = sample_rate
        self.num_bands = 4
        
    def _get_frequency_ranges_from_bands(self, band_names):
        """
        Get frequency ranges for specified bands
        """
        ranges = []
        for band in band_names:
            band_info = None
            if band in self.ANIMAL_RANGES:
                band_info = self.ANIMAL_RANGES[band]
            else:
                for b_info in self.ANIMAL_RANGES.values():
                    if b_info['id'] == band:
                        band_info = b_info
                        break
            
            if band_info:
                ranges.append((band_info['low'], band_info['high']))
            else:
                ranges.append((0, self.sample_rate / 2))
        
        return ranges
    
    def create_bandpass_filter(self, low_freq, high_freq, order=5):
        """Create a butterworth bandpass filter"""
        nyquist = self.sample_rate / 2
        low = low_freq / nyquist
        high = high_freq / nyquist
        low = max(0.001, min(0.999, low))
        high = max(0.001, min(0.999, high))
        if low >= high:
            low = max(0.001, high - 0.01)
        
        try:
            sos = signal.butter(order, [low, high], btype='band', output='sos')
            return sos
        except Exception:
            return None
    
    def apply_bandpass_filter(self, data, low_freq, high_freq, order=5):
        """Apply bandpass filter to signal using SOS for stability."""
        sos = self.create_bandpass_filter(low_freq, high_freq, order)
        if sos is None:
            return data
        try:
            return signal.sosfiltfilt(sos, data)
        except Exception:
            return data

    def process_signal(
        self,
        signal_data: np.ndarray,
        gains: List[float],
        animal_names: List[str],
        sample_rate: float = None,
        method: str = "fft",
        wavelet: str = "db4",
        wavelet_level: int = 6,
        sliders_wavelet: Optional[List[float]] = None
    ) -> dict:
        """
        Process signal with animal-based equalization
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.sample_rate)
        
        input_fft = self._compute_fft_data(signal_data, sr)
        input_spectrogram = self._compute_spectrogram_data(signal_data, sr)
        
        input_coeffs = None
        output_coeffs = None
        band_waveforms = None
        
        if method == "fft":
            processed_gains = list(gains)
            while len(processed_gains) < len(self.ANIMAL_RANGES):
                processed_gains.append(1.0)
            processed_gains = processed_gains[:len(self.ANIMAL_RANGES)]

            # Apply gains directly in the frequency domain (same approach as music/human modes).
            # This is lossless: gain=1.0 leaves FFT bins unchanged ⟹ output ≡ input.
            fft_data = fft(signal_data)
            freqs = fftfreq(len(signal_data), 1.0 / sr)
            abs_freqs = np.abs(freqs)

            # Order must match ANIMAL_RANGES: frog, birds, dog, cat
            bands_list = ['frog', 'birds', 'dog', 'cat']
            for i, band_name in enumerate(bands_list):
                band_info = self.ANIMAL_RANGES[band_name]
                mask = (abs_freqs >= band_info['low']) & (abs_freqs < band_info['high'])
                fft_data[mask] *= processed_gains[i]

            equalized_signal = np.real(np.fft.ifft(fft_data))
        else:
            wavelet_name = wavelet if wavelet in pywt.wavelist(kind='discrete') else "db4"
            max_level = pywt.dwt_max_level(len(signal_data), pywt.Wavelet(wavelet_name).dec_len)
            actual_level = max(1, min(int(wavelet_level or 6), max_level))
            # Ensure at least 7 levels for full animal frequency coverage
            actual_level = max(7, min(actual_level, max_level))
            freq_ranges = self._get_frequency_ranges(animal_names)
            input_coeffs, output_coeffs, equalized_signal, band_waveforms = self._apply_wavelet_equalization(
                signal_data,
                freq_ranges,
                gains,
                wavelet_name,
                actual_level,
                sr,
                sliders_wavelet,
                band_names=animal_names
            )
        
        output_fft = self._compute_fft_data(equalized_signal, sr)
        output_spectrogram = self._compute_spectrogram_data(equalized_signal, sr)
        
        return {
            "signal": equalized_signal.tolist(),
            "input_fft": input_fft,
            "fft": output_fft,
            "input_spectrogram": input_spectrogram,
            "spectrogram": output_spectrogram,
            "input_coeffs": input_coeffs,
            "output_coeffs": output_coeffs,
            "band_waveforms": band_waveforms,
            "processing_time": time.time() - start_time
        }

    def _detail_index_for_level(self, total_level: int, detail_level: int) -> int:
        return total_level - detail_level + 1

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

    def _compute_level_gains_direct(
        self,
        gains: List[float],
        level: int,
        sliders_wavelet: Optional[List[float]] = None,
        approx_gain: float = 1.0
    ) -> Tuple[List[float], float]:
        """
        Compute level gains from ANIMAL_LEVEL_MAP with multi-level per animal.
        Handles both numeric levels and 'cA' approximation coefficients.
        Returns: (level_gains, approx_gain_out)
        """
        level_gains = [1.0] * (level + 1)
        cA_gain = 1.0
        
        # Fixed animal order matching ANIMAL_RANGES keys
        animal_order = ['frog', 'birds', 'dog', 'cat']
        
        for idx, animal_key in enumerate(animal_order):
            if idx >= len(gains):
                break
            
            gain = self._clamp_gain(gains[idx])
            if animal_key in self.ANIMAL_LEVEL_MAP:
                # Each animal can have multiple levels (including 'cA')
                for lv in self.ANIMAL_LEVEL_MAP[animal_key]:
                    if lv == "cA":
                        # Handle approximation coefficients (for Frog lowest frequencies)
                        wavelet_mult = 1.0
                        if sliders_wavelet is not None and len(sliders_wavelet) > 0:
                            wavelet_mult = self._clamp_gain(sliders_wavelet[0])  # Use first slider for approx
                        cA_gain = gain * wavelet_mult
                    elif isinstance(lv, int) and lv <= level:
                        # Handle numeric detail levels
                        wavelet_mult = 1.0
                        if sliders_wavelet is not None and lv - 1 < len(sliders_wavelet):
                            wavelet_mult = self._clamp_gain(sliders_wavelet[lv - 1])
                        combined_gain = gain * wavelet_mult
                        # Mix gains if multiple animals affect same level
                        if level_gains[lv] != 1.0:
                            level_gains[lv] = np.mean([level_gains[lv], combined_gain])
                        else:
                            level_gains[lv] = combined_gain
        
        return level_gains, cA_gain

    def _apply_wavelet_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[List[Tuple[float, float]]],
        gains: List[float],
        wavelet: str,
        level: int,
        sample_rate: float,
        sliders_wavelet: Optional[List[float]] = None,
        band_names: Optional[List[str]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray, List[Dict[str, Any]]]:
        coeffs = pywt.wavedec(signal, wavelet, level=level)
        
        input_detail_coeffs = []
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            input_detail_coeffs.append(coeffs[idx].tolist())

        # Compute level gains directly from ANIMAL_LEVEL_MAP using fixed animal order
        level_gains, cA_gain = self._compute_level_gains_direct(
            gains=gains,
            level=level,
            sliders_wavelet=sliders_wavelet
        )

        out_coeffs = [np.array(c, copy=True) for c in coeffs]

        # Apply approximation gain if Frog uses cA (lowest frequencies)
        out_coeffs[0] = out_coeffs[0] * cA_gain

        # Apply computed level gains (from animal bands)
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            out_coeffs[idx] = out_coeffs[idx] * level_gains[lv]

        output_detail_coeffs = []
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            output_detail_coeffs.append(out_coeffs[idx].tolist())

        reconstructed = pywt.waverec(out_coeffs, wavelet)
        reconstructed = np.asarray(reconstructed[:len(signal)], dtype=float)

        band_waveforms = self._build_band_waveforms(
            input_coeffs=coeffs,
            output_coeffs=out_coeffs,
            freq_ranges=freq_ranges,
            wavelet=wavelet,
            level=level,
            sample_rate=sample_rate,
            signal_len=len(signal),
            band_names=band_names
        )
        
        return input_detail_coeffs, output_detail_coeffs, reconstructed, band_waveforms

    def _levels_for_ranges(
        self,
        sub_ranges: List[Tuple[float, float]],
        level: int,
        sample_rate: float
    ) -> List[int]:
        levels = []
        for lv in range(1, level + 1):
            lv_low, lv_high = self._detail_level_band(lv, sample_rate)
            for low, high in sub_ranges:
                if self._ranges_overlap(lv_low, lv_high, float(low), float(high)):
                    levels.append(lv)
                    break
        return levels

    def _reconstruct_levels_only(
        self,
        coeffs: List[np.ndarray],
        wavelet: str,
        level: int,
        active_levels: List[int],
        signal_len: int
    ) -> np.ndarray:
        isolated = [np.zeros_like(c) for c in coeffs]
        for lv in active_levels:
            idx = self._detail_index_for_level(level, lv)
            isolated[idx] = np.array(coeffs[idx], copy=True)

        reconstructed = pywt.waverec(isolated, wavelet)
        return np.asarray(reconstructed[:signal_len], dtype=float)

    def _build_band_waveforms(
        self,
        input_coeffs: List[np.ndarray],
        output_coeffs: List[np.ndarray],
        freq_ranges: List[List[Tuple[float, float]]],
        wavelet: str,
        level: int,
        sample_rate: float,
        signal_len: int,
        band_names: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        waveforms = []
        for idx, sub_ranges in enumerate(freq_ranges):
            active_levels = self._levels_for_ranges(sub_ranges, level, sample_rate)

            if active_levels:
                in_sig = self._reconstruct_levels_only(input_coeffs, wavelet, level, active_levels, signal_len)
                out_sig = self._reconstruct_levels_only(output_coeffs, wavelet, level, active_levels, signal_len)
            else:
                in_sig = np.zeros(signal_len, dtype=float)
                out_sig = np.zeros(signal_len, dtype=float)

            valid_lows = [float(r[0]) for r in sub_ranges if len(r) >= 2]
            valid_highs = [float(r[1]) for r in sub_ranges if len(r) >= 2]
            low = min(valid_lows) if valid_lows else 0.0
            high = max(valid_highs) if valid_highs else (sample_rate / 2.0)

            waveforms.append({
                "band_index": idx,
                "name": str(band_names[idx]) if band_names and idx < len(band_names) else f"Band {idx + 1}",
                "low": low,
                "high": high,
                "levels": active_levels,
                "input": in_sig.tolist(),
                "output": out_sig.tolist()
            })

        return waveforms

    def _get_frequency_ranges(self, animal_names: List[str]) -> List[List[Tuple[float, float]]]:
        ranges = []
        for name in animal_names:
            normalized = str(name or "").strip().lower().replace(" ", "_")
            if normalized in ("frog", "frogs"):
                key = "frog"
            elif normalized in ("bird", "birds", "songbird", "songbirds"):
                key = "birds"
            elif normalized in ("dog", "dogs", "canine", "canines"):
                key = "dog"
            elif normalized in ("cat", "cats", "feline", "felines"):
                key = "cat"
            else:
                key = None

            if key and key in self.ANIMAL_RANGES:
                b = self.ANIMAL_RANGES[key]
                ranges.append([(float(b['low']), float(b['high']))])
            else:
                ranges.append([(0.0, self.sample_rate / 2.0)])

        return ranges

    def _compute_fft_data(self, signal_data, sample_rate):
        """Compute FFT for visualization."""
        fft_vals = fft(signal_data)
        freqs = fftfreq(len(signal_data), 1.0 / sample_rate)
        magnitudes = np.abs(fft_vals)
        positive_idx = freqs > 0
        pos_freqs = freqs[positive_idx]
        pos_mags = magnitudes[positive_idx]
        step = max(1, len(pos_freqs) // 1000)
        return {
            "frequencies": pos_freqs[::step].tolist(),
            "magnitudes": pos_mags[::step].tolist()
        }

    def _compute_spectrogram_data(self, signal_data, sample_rate):
        """Compute spectrogram for visualization."""
        from scipy.signal import spectrogram
        f, t, Sxx = spectrogram(signal_data, sample_rate, window='hann', nperseg=1024, noverlap=768)
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12))
        Sxx_db = np.clip(Sxx_db, -120.0, 0.0)
        freq_step = max(1, len(f) // 100)
        time_step = max(1, len(t) // 100)
        return {
            "frequencies": f[::freq_step].tolist(),
            "times": t[::time_step].tolist(),
            "magnitude": Sxx_db[::freq_step, ::time_step].tolist()
        }

animals_service = AnimalModeSeparator(sample_rate=44100)