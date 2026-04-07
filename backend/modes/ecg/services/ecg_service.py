import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple, Optional, Dict, Any
import pywt


class ECGModeService:
    """Service for ECG arrhythmia mode signal processing"""
    
    # ECG component bands aligned with UI labels.
    COMPONENT_RANGES = {
        "Normal": [(2.2, 15.5)],
        "AFib": [(0.0, 179.4)],
        "VTach": [(2.2, 3.3)],
        "HeartBlock": [(2.2, 31.0)],
    }

    # Alias map to keep previous labels/settings working.
    COMPONENT_NAME_ALIASES = {
        "normal": "Normal",
        "normal sinus": "Normal",
        "afib": "AFib",
        "atrial fibrillation": "AFib",
        "apc (atrial premature)": "AFib",
        "ventricular fibrillation": "AFib",
        "vf (ventricular fibrillation)": "AFib",
        "vtach": "VTach",
        "vt (ventricular tachycardia)": "VTach",
        "ventricular tachycardia": "VTach",
        "pvc (premature ventricular)": "VTach",
        "heartblock": "HeartBlock",
        "heart block": "HeartBlock",
    }

    # Level 10 details: 0.24-0.48 Hz. Level 10 approx: 0-0.24 Hz.
    # L9: 0.48-0.97, L8: 0.97-1.95, L7: 1.95-3.9, L6: 3.9-7.8, L5: 7.8-15.6, L4: 15.6-31.2
    COMPONENT_LEVEL_MAP = {
        "Normal": [5, 6, 7],
        "AFib": [1, 2, 3, 4, 5, 6, 7],
        "VTach": [7],
        "HeartBlock": [4, 5, 6, 7],
    }
    
    def __init__(self):
        self.default_sample_rate = 500  # Standard clinical ECG SR

    def _canonical_component_name(self, name: str) -> str:
        raw = str(name or "").strip()
        if raw in self.COMPONENT_RANGES:
            return raw

        key = raw.lower()
        if key in self.COMPONENT_NAME_ALIASES:
            return self.COMPONENT_NAME_ALIASES[key]

        raise ValueError(
            f"Unknown ECG component label '{name}'. Allowed labels: {sorted(self.COMPONENT_RANGES.keys())}"
        )
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        component_names: List[str],
        sample_rate: float = None,
        method: str = "fft",
        wavelet: str = "db4",
        wavelet_level: int = 6,
        sliders_wavelet: Optional[List[float]] = None
    ) -> dict:
        """
        Process signal with ECG-based equalization
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)
        
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        input_coeffs = None
        output_coeffs = None
        band_waveforms = None
        
        if method == "fft":
            freq_ranges = self._get_frequency_ranges(component_names)
            equalized_signal = self._apply_ecg_equalization(signal, freq_ranges, gains, sr)
        else:
            wavelet_name = self._validate_wavelet(wavelet)
            max_level = pywt.dwt_max_level(len(signal), pywt.Wavelet(wavelet_name).dec_len)
            actual_level = max(1, min(int(wavelet_level or 6), max_level))
            freq_ranges = self._get_frequency_ranges(component_names)
            
            input_coeffs, output_coeffs, equalized_signal, band_waveforms = self._apply_wavelet_equalization(
                signal, freq_ranges, gains, wavelet_name, actual_level, sr, sliders_wavelet
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

    def _validate_wavelet(self, wavelet: str) -> str:
        """Validates the wavelet name and returns a default if invalid."""
        if wavelet in pywt.wavelist(kind='discrete'):
            return wavelet
        return "db4" # Default to Daubechies 4

    def _detail_index_for_level(self, total_level: int, detail_level: int) -> int:
        """
        Calculates the index in the pywt.wavedec output for a given detail level.
        pywt.wavedec returns [cA_n, cD_n, cD_n-1, ..., cD_1]
        So, cD_n is at index 1, cD_n-1 at index 2, ..., cD_1 at index n.
        """
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

    def _compute_level_gains_from_ranges(
        self,
        freq_ranges: List[List[Tuple[float, float]]],
        gains: List[float],
        level: int,
        sample_rate: float,
        sliders_wavelet: Optional[List[float]] = None
    ) -> List[float]:
        level_gains = [1.0] * (level + 1)

        for lv in range(1, level + 1):
            lv_low, lv_high = self._detail_level_band(lv, sample_rate)
            matched = []
            for ranges, gain in zip(freq_ranges, gains):
                for low, high in ranges:
                    if self._ranges_overlap(lv_low, lv_high, float(low), float(high)):
                        matched.append(self._clamp_gain(gain))
                        break

            base_gain = float(np.mean(matched)) if matched else 1.0
            if sliders_wavelet is not None and lv - 1 < len(sliders_wavelet):
                base_gain *= self._clamp_gain(sliders_wavelet[lv - 1])
            level_gains[lv] = self._clamp_gain(base_gain)

        return level_gains

    def _apply_wavelet_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[List[Tuple[float, float]]],
        gains: List[float],
        wavelet: str,
        level: int,
        sample_rate: float,
        sliders_wavelet: Optional[List[float]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray, List[Dict[str, Any]]]:
        """Apply DWT-based equalization using dyadic detail-band overlap."""
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

        band_waveforms = self._build_band_waveforms(
            input_coeffs=coeffs,
            output_coeffs=out_coeffs,
            freq_ranges=freq_ranges,
            wavelet=wavelet,
            level=level,
            sample_rate=sample_rate,
            signal_len=len(signal)
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
        signal_len: int
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
                "name": f"Band {idx + 1}",
                "low": low,
                "high": high,
                "levels": active_levels,
                "input": in_sig.tolist(),
                "output": out_sig.tolist()
            })

        return waveforms
    
    def _get_frequency_ranges(self, component_names: List[str]) -> List[List[Tuple[float, float]]]:
        ranges = []
        for name in component_names:
            canonical = self._canonical_component_name(name)
            ranges.append(list(self.COMPONENT_RANGES[canonical]))
        return ranges
    
    def _apply_ecg_equalization(self, signal, freq_ranges, gains, sample_rate):
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        abs_freqs = np.abs(freqs)
        for sub_ranges, gain in zip(freq_ranges, gains):
            mask = np.zeros(len(freqs), dtype=bool)
            for low, high in sub_ranges:
                mask |= (abs_freqs >= low) & (abs_freqs < high)
            fft_data[mask] *= gain
        return np.real(np.fft.ifft(fft_data))
    
    def _compute_fft_data(self, signal, sample_rate):
        fft_vals = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        magnitudes = np.abs(fft_vals)
        positive_idx = freqs > 0
        step = max(1, len(freqs[freqs > 0]) // 1000)
        return {
            "frequencies": freqs[positive_idx][::step].tolist(),
            "magnitudes": magnitudes[positive_idx][::step].tolist()
        }

    def _compute_spectrogram_data(self, signal, sample_rate):
        from scipy.signal import spectrogram
        signal = np.asarray(signal, dtype=np.float32).reshape(-1)
        if signal.size == 0:
            return {"frequencies": [], "times": [], "magnitude": []}

        # Remove only global DC once; avoid per-window detrending flicker artifacts.
        signal = signal - float(np.mean(signal))
        seg_len = min(256, len(signal) // 4) if len(signal) >= 16 else max(4, len(signal))
        overlap = int(seg_len * 0.75)
        f, t, Sxx = spectrogram(
            signal,
            sample_rate,
            window='hann',
            nperseg=seg_len,
            noverlap=overlap,
            detrend=False,
            scaling='spectrum',
            mode='psd'
        )
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12))
        Sxx_db = np.clip(Sxx_db, -120.0, 0.0)
        freq_step = max(1, len(f) // 50)
        time_step = max(1, len(t) // 50)
        f_ds = f[::freq_step]
        t_ds = t[::time_step]
        Sxx_ds = np.empty((len(f_ds), len(t_ds)), dtype=np.float32)
        for i in range(len(f_ds)):
            fs = i * freq_step
            fe = min(len(f), fs + freq_step)
            for j in range(len(t_ds)):
                ts = j * time_step
                te = min(len(t), ts + time_step)
                Sxx_ds[i, j] = float(np.mean(Sxx_db[fs:fe, ts:te]))
        return {
            "frequencies": f_ds.tolist(),
            "times": t_ds.tolist(),
            "magnitude": Sxx_ds.tolist()
        }

ecg_service = ECGModeService()
