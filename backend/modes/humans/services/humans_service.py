import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple, Optional
import pywt


class HumansModeService:
    """Service for human voice mode signal processing"""
    
    # Exact Fundamental Frequency Ranges for voice types
    VOICE_RANGES = {
        "Male Voice":     [(85, 180)],   # Adult males 85-180 Hz
        "Female Voice":   [(165, 255)],  # Adult females 165-255 Hz
        "Young Speaker":  [(250, 450)],  # Children 250-450 Hz
        "Old Speaker":    [(80, 150)],   # Older adults (typically overlaps male low/mid)
    }

    # 8-level Human Voice Configuration at 22.05kHz
    # L1: 5.5k-11k, L2: 2.7k-5.5k, L3: 1378-2756, L4: 689-1378
    # L5: 344-689, L6: 172-344, L7: 86-172, L8: 43-86, A8: 0-43
    HUMAN_LEVEL_MAP = {
        "male": [6, 7],      # 86 - 344 Hz
        "female": [5, 6],    # 172 - 689 Hz
        "young": [5, 6],     # 172 - 689 Hz
        "old": [7, 8]        # 43 - 172 Hz
    }

    _ORDERED_KEYS = ["Male Voice", "Female Voice", "Young Speaker", "Old Speaker"]
    
    def __init__(self):
        self.default_sample_rate = 22050  # Default SR for voice
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        voice_names: List[str],
        sample_rate: float = None,
        method: str = "fft",
        wavelet: str = "db4",
        wavelet_level: int = 6,
        sliders_wavelet: Optional[List[float]] = None
    ) -> dict:
        """
        Process signal with voice-based equalization
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)
        
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        input_coeffs = None
        output_coeffs = None
        
        if method == "fft":
            freq_ranges = self._get_frequency_ranges(voice_names)
            equalized_signal = self._apply_voice_equalization(signal, freq_ranges, gains, sr)
        else:
            wavelet_name = wavelet if wavelet in pywt.wavelist(kind='discrete') else "db4"
            actual_level = 8 if not sliders_wavelet else max(1, min(int(wavelet_level or 6), 8))
            input_coeffs, output_coeffs, equalized_signal = self._apply_wavelet_equalization(
                signal, voice_names, gains, wavelet_name, actual_level, sliders_wavelet
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
            "processing_time": time.time() - start_time
        }

    def _detail_index_for_level(self, total_level: int, detail_level: int) -> int:
        return total_level - detail_level + 1

    def _compute_level_gains(self, voice_names: List[str], gains: List[float], level: int) -> List[float]:
        level_gains = [1.0] * (level + 1)
        for name, gain in zip(voice_names, gains):
            parts = str(name or "").lower().split()
            if parts:
                name_low = parts[0]
                mapped = self.HUMAN_LEVEL_MAP.get(name_low, [])
                g = float(gain)
                for lv in mapped:
                    if 0 <= lv <= level:
                        level_gains[lv] *= g
        return level_gains

    def _apply_wavelet_equalization(
        self,
        signal: np.ndarray,
        voice_names: List[str],
        gains: List[float],
        wavelet: str,
        level: int,
        sliders_wavelet: Optional[List[float]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray]:
        coeffs = pywt.wavedec(signal, wavelet, level=level)

        # Light denoise so wavelet basis affects output by default.
        try:
            d1 = np.asarray(coeffs[-1], dtype=float)
            sigma = float(np.median(np.abs(d1)) / 0.6745) if d1.size else 0.0
            if sigma > 0:
                uthresh = (sigma * np.sqrt(2.0 * np.log(max(2, len(signal))))) * 0.35
                for i in range(1, len(coeffs)):
                    coeffs[i] = pywt.threshold(coeffs[i], uthresh, mode="soft")
        except Exception:
            pass
        
        input_detail_coeffs = []
        input_detail_coeffs.append(coeffs[0].tolist())
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            input_detail_coeffs.append(coeffs[idx].tolist())

        level_gains = self._compute_level_gains(voice_names, gains, level)

        if sliders_wavelet is not None:
            for i, gain in enumerate(sliders_wavelet):
                lv = i + 1
                if lv <= level:
                    level_gains[lv] *= gain

        out_coeffs = [np.array(c, copy=True) for c in coeffs]
        
        out_coeffs[0] = out_coeffs[0] * level_gains[0]
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            out_coeffs[idx] = out_coeffs[idx] * level_gains[lv]

        output_detail_coeffs = []
        output_detail_coeffs.append(out_coeffs[0].tolist())
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            output_detail_coeffs.append(out_coeffs[idx].tolist())

        reconstructed = pywt.waverec(out_coeffs, wavelet)
        reconstructed = np.asarray(reconstructed[:len(signal)], dtype=float)
        
        return input_detail_coeffs, output_detail_coeffs, reconstructed
    
    def _get_frequency_ranges(self, voice_names: List[str]) -> List[List[Tuple[float, float]]]:
        """Get disjoint frequency sub-ranges for voice types."""
        ranges = []
        for idx, name in enumerate(voice_names):
            if name in self.VOICE_RANGES:
                ranges.append(list(self.VOICE_RANGES[name]))
            elif idx < len(self._ORDERED_KEYS):
                key = self._ORDERED_KEYS[idx]
                ranges.append(list(self.VOICE_RANGES[key]))
            else:
                ranges.append([(80, 500)])
        return ranges
    
    def _apply_voice_equalization(self, signal, freq_ranges, gains, sample_rate):
        """Apply FFT-based equalization."""
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
        seg_len = min(512, len(signal) // 4) if len(signal) >= 32 else max(8, len(signal))
        overlap = int(seg_len * 0.75)
        f, t, Sxx = spectrogram(signal, sample_rate, window='hann', nperseg=seg_len, noverlap=overlap)
        ref = max(float(np.max(Sxx)), 1e-12)
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12) / ref)
        Sxx_db = np.maximum(Sxx_db, -80.0)
        freq_step = max(1, len(f) // 100)
        time_step = max(1, len(t) // 100)
        return {
            "frequencies": f[::freq_step].tolist(),
            "times": t[::time_step].tolist(),
            "magnitude": Sxx_db[::freq_step, ::time_step].tolist()
        }

humans_service = HumansModeService()
