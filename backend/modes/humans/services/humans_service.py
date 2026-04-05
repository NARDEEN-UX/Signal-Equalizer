import math
import os
import tempfile
import shutil
import pathlib
import urllib.request
import numpy as np
from scipy.fft import fft, fftfreq
from scipy.signal import resample_poly, butter, sosfilt, stft, istft, find_peaks
import time
from typing import List, Tuple, Optional, Dict, Any
import pywt
import soundfile as sf


class HumansModeService:
    """Service for human voice mode signal processing"""
    
    # Human mode frequency labels used in DSP controls.
    VOICE_RANGES = {
        "Children Voices (Pre-Puberty)": [(220, 300), (350, 600)],
        "French Audio (FLEURS Dataset)": [(128.12, 685.94)],
        "Spanish Audio (FLEURS Dataset)": [(128.12, 1792.19)],
        "All Female Actors (Even Numbers)": [(205.96, 1444.01)],
        "All Male Actors (Odd Numbers)": [(112.08, 1322.75)],
    }

    # Broader fallback isolation ranges to keep separated stems audible
    # when AI model loading/inference is unavailable.
    FALLBACK_VOICE_ISOLATION_RANGES = {
        "Children Voices (Pre-Puberty)": [(220, 300), (350, 600), (600, 1400)],
        "French Audio (FLEURS Dataset)": [(120, 700), (700, 1400)],
        "Spanish Audio (FLEURS Dataset)": [(120, 1800)],
        "All Female Actors (Even Numbers)": [(200, 1450)],
        "All Male Actors (Odd Numbers)": [(110, 1325)],
    }

    # Target pitch centers used to map anonymous separated outputs
    # back to the notebook's fixed speaker classes.
    VOICE_TARGET_PITCH = {
        "Children Voices (Pre-Puberty)": 260.0,
        "French Audio (FLEURS Dataset)": 210.0,
        "Spanish Audio (FLEURS Dataset)": 230.0,
        "All Female Actors (Even Numbers)": 220.0,
        "All Male Actors (Odd Numbers)": 125.0,
    }

    # Pitch bins (Hz) for heuristic voice classification.
    VOICE_PITCH_BINS = (
        (170.0, "All Male Actors (Odd Numbers)"),
        (250.0, "All Female Actors (Even Numbers)"),
        (float("inf"), "Children Voices (Pre-Puberty)")
    )
    PITCH_FMIN = 50.0
    PITCH_FMAX = 500.0

    NOTEBOOK_BANDS = (
        (20.0, 250.0),
        (250.0, 800.0),
        (800.0, 3000.0),
        (3000.0, 4000.0),
    )
    NOTEBOOK_ACTIVE_BAND_THRESHOLD = 0.10
    # UI-oriented slider hints used to keep AI-separated voice ranges distinct.
    LABEL_SLIDER_HINTS = {
        "Children Voices (Pre-Puberty)": (220.0, 600.0),
        "French Audio (FLEURS Dataset)": (128.12, 685.94),
        "Spanish Audio (FLEURS Dataset)": (128.12, 1792.19),
        "All Female Actors (Even Numbers)": (205.96, 1444.01),
        "All Male Actors (Odd Numbers)": (112.08, 1322.75),
    }
    SEPFORMER_MODEL_DEFAULT = "speechbrain/sepformer-wsj02mix"
    SEPFORMER_SAMPLE_RATE = 8000

    # Canonical mapping with aliases to keep legacy presets compatible.
    VOICE_NAME_ALIASES = {
        "children voices (pre-puberty)": "Children Voices (Pre-Puberty)",
        "children voices": "Children Voices (Pre-Puberty)",
        "children": "Children Voices (Pre-Puberty)",
        "child": "Children Voices (Pre-Puberty)",
        "child voice": "Children Voices (Pre-Puberty)",
        "kid": "Children Voices (Pre-Puberty)",
        "kid voices": "Children Voices (Pre-Puberty)",
        "french audio (fleurs dataset)": "French Audio (FLEURS Dataset)",
        "french audio": "French Audio (FLEURS Dataset)",
        "french": "French Audio (FLEURS Dataset)",
        "spanish audio (fleurs dataset)": "Spanish Audio (FLEURS Dataset)",
        "spanish audio": "Spanish Audio (FLEURS Dataset)",
        "spanish": "Spanish Audio (FLEURS Dataset)",
        "all female actors (even numbers)": "All Female Actors (Even Numbers)",
        "all female actors": "All Female Actors (Even Numbers)",
        "female actors": "All Female Actors (Even Numbers)",
        "all male actors (odd numbers)": "All Male Actors (Odd Numbers)",
        "all male actors": "All Male Actors (Odd Numbers)",
        "male actors": "All Male Actors (Odd Numbers)",
        "male": "All Male Actors (Odd Numbers)",
        "male voice": "All Male Actors (Odd Numbers)",
        "man voice": "All Male Actors (Odd Numbers)",
        "man": "All Male Actors (Odd Numbers)",
        "female": "All Female Actors (Even Numbers)",
        "female voice": "All Female Actors (Even Numbers)",
        "old": "All Male Actors (Odd Numbers)",
        "old voice": "All Male Actors (Odd Numbers)",
        "old man voice": "All Male Actors (Odd Numbers)",
        "old man": "All Male Actors (Odd Numbers)",
        "spanish woman voice": "Spanish Audio (FLEURS Dataset)",
        "spanish woman": "Spanish Audio (FLEURS Dataset)",
        "young": "Children Voices (Pre-Puberty)",
        "young speaker": "Children Voices (Pre-Puberty)",
        "female old": "All Female Actors (Even Numbers)",
        "female_old": "All Female Actors (Even Numbers)",
        "old female": "All Female Actors (Even Numbers)",
        "female young": "All Female Actors (Even Numbers)",
        "female_young": "All Female Actors (Even Numbers)",
        "female yound": "All Female Actors (Even Numbers)",
        "young female": "All Female Actors (Even Numbers)",
        "male old": "All Male Actors (Odd Numbers)",
        "male_old": "All Male Actors (Odd Numbers)",
        "old male": "All Male Actors (Odd Numbers)",
        "male young": "All Male Actors (Odd Numbers)",
        "male_young": "All Male Actors (Odd Numbers)",
        "male yound": "All Male Actors (Odd Numbers)",
        "young male": "All Male Actors (Odd Numbers)",
        "old speaker": "All Male Actors (Odd Numbers)",
        "voice 1": "All Male Actors (Odd Numbers)",
        "voice 2": "All Female Actors (Even Numbers)",
        "voice 3": "Spanish Audio (FLEURS Dataset)",
        "voice 4": "French Audio (FLEURS Dataset)",
        "voice 5": "Children Voices (Pre-Puberty)",
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

    def __init__(self):
        self.default_sample_rate = 44100
        self._sepformer_model = None
        self._sepformer_model_name = None
        self._sepformer_device = "cpu"

    def _canonical_voice_name(self, name: str) -> str:
        raw = str(name or "").strip()
        if raw in self.VOICE_RANGES:
            return raw

        key = raw.lower()
        if key in self.VOICE_NAME_ALIASES:
            return self.VOICE_NAME_ALIASES[key]

        raise ValueError(
            f"Unknown human voice label '{name}'. Allowed labels: {sorted(self.VOICE_RANGES.keys())}"
        )

    @staticmethod
    def _display_voice_name(canonical_name: str) -> str:
        raw = str(canonical_name or "").strip().lower()
        if "female" in raw:
            return "female"
        if "male" in raw:
            return "male"
        return str(canonical_name or "")

    def _to_int_sample_rate(self, sample_rate: Optional[float]) -> int:
        raw = sample_rate if sample_rate is not None else self.default_sample_rate
        try:
            value = int(round(float(raw)))
        except Exception as exc:
            raise ValueError(f"Invalid sample_rate '{sample_rate}'") from exc
        return max(1, value)
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        voice_names: List[str],
        sample_rate: float = None,
        bands: Optional[List[Dict]] = None,
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
        band_waveforms = None
        
        if method == "fft":
            freq_ranges = self._resolve_frequency_ranges(
                voice_names=voice_names,
                bands=bands,
                count=len(gains)
            )
            equalized_signal = self._apply_voice_equalization(signal, freq_ranges, gains, sr)
        else:
            wavelet_name = wavelet if wavelet in pywt.wavelist(kind='discrete') else "db4"
            max_level = pywt.dwt_max_level(len(signal), pywt.Wavelet(wavelet_name).dec_len)
            actual_level = max(1, min(int(wavelet_level or 6), max_level))
            freq_ranges = self._resolve_frequency_ranges(
                voice_names=voice_names,
                bands=bands,
                count=len(gains)
            )
            input_coeffs, output_coeffs, equalized_signal, band_waveforms = self._apply_wavelet_equalization(
                signal,
                freq_ranges,
                gains,
                wavelet_name,
                actual_level,
                sr,
                sliders_wavelet,
                band_names=voice_names
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

    @staticmethod
    def _combine_overlap_gains(matched_gains: List[float]) -> float:
        if not matched_gains:
            return 1.0
        active = [g for g in matched_gains if g > 1e-8]
        if active:
            return float(np.mean(matched_gains))
        return 0.0

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

            base_gain = self._combine_overlap_gains(matched)
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
        sliders_wavelet: Optional[List[float]] = None,
        band_names: Optional[List[str]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray, List[Dict[str, Any]]]:
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
    
    def _get_frequency_ranges(self, voice_names: List[str]) -> List[List[Tuple[float, float]]]:
        """Get frequency sub-ranges for explicitly labeled voice types."""
        ranges = []
        for name in voice_names:
            canonical = self._canonical_voice_name(name)
            ranges.append(list(self.VOICE_RANGES[canonical]))
        return ranges

    def _get_frequency_ranges_from_bands(self, bands: List[Dict]) -> List[List[Tuple[float, float]]]:
        ranges = []
        for band in bands:
            if not isinstance(band, dict):
                ranges.append([(20.0, 20000.0)])
                continue

            sub_ranges = []
            raw_ranges = band.get('ranges')
            if isinstance(raw_ranges, list):
                for item in raw_ranges:
                    if isinstance(item, (list, tuple)) and len(item) >= 2:
                        low = float(item[0])
                        high = float(item[1])
                        if high > low:
                            sub_ranges.append((low, high))

            if not sub_ranges and 'low' in band and 'high' in band:
                low = float(band.get('low', 20))
                high = float(band.get('high', 20000))
                if high > low:
                    sub_ranges.append((low, high))

            ranges.append(sub_ranges or [(20.0, 20000.0)])
        return ranges

    def _resolve_frequency_ranges(
        self,
        voice_names: List[str],
        bands: Optional[List[Dict]],
        count: int
    ) -> List[List[Tuple[float, float]]]:
        if bands:
            ranges = self._get_frequency_ranges_from_bands(bands)
        else:
            ranges = self._get_frequency_ranges(voice_names)

        if len(ranges) < count:
            ranges.extend([[(20.0, 20000.0)]] * (count - len(ranges)))
        return ranges[:count]
    
    def _apply_voice_equalization(self, signal, freq_ranges, gains, sample_rate):
        """Apply FFT-based equalization."""
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        abs_freqs = np.abs(freqs)
        mask_rows = []
        gain_rows = []
        for sub_ranges, gain in zip(freq_ranges, gains):
            mask = np.zeros(len(freqs), dtype=bool)
            for low, high in sub_ranges:
                mask |= (abs_freqs >= low) & (abs_freqs < high)
            if np.any(mask):
                mask_rows.append(mask)
                gain_rows.append(self._clamp_gain(gain))

        if mask_rows:
            mask_matrix = np.vstack(mask_rows)
            gain_vector = np.asarray(gain_rows, dtype=float)[:, np.newaxis]

            matched_count = np.sum(mask_matrix, axis=0)
            matched_sum = np.sum(mask_matrix * gain_vector, axis=0)

            active_matrix = mask_matrix & (gain_vector > 1e-8)
            active_count = np.sum(active_matrix, axis=0)
            matched_any = np.any(mask_matrix, axis=0)

            combined_gain = np.ones_like(abs_freqs, dtype=float)
            has_active = active_count > 0
            combined_gain[has_active] = matched_sum[has_active] / matched_count[has_active]
            combined_gain[matched_any & ~has_active] = 0.0

            fft_data = fft_data * combined_gain

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
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12))
        Sxx_db = np.clip(Sxx_db, -120.0, 0.0)
        freq_step = max(1, len(f) // 100)
        time_step = max(1, len(t) // 100)
        return {
            "frequencies": f[::freq_step].tolist(),
            "times": t[::time_step].tolist(),
            "magnitude": Sxx_db[::freq_step, ::time_step].tolist()
        }

    @staticmethod
    def _rms(signal: np.ndarray) -> float:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size == 0:
            return 0.0
        return float(np.sqrt(np.mean(np.square(data))))

    @staticmethod
    def _fit_signal_length(signal: np.ndarray, target_length: int) -> np.ndarray:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if len(data) == target_length:
            return data
        if len(data) > target_length:
            return data[:target_length]
        padded = np.zeros(target_length, dtype=np.float32)
        padded[:len(data)] = data
        return padded

    @staticmethod
    def _estimate_frequency_range(signal: np.ndarray, sample_rate: int) -> Tuple[float, float]:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size < 32:
            nyquist = max(20.0, sample_rate / 2.0)
            return 20.0, float(min(20000.0, nyquist))

        spectrum = np.fft.rfft(data)
        power = np.abs(spectrum) ** 2
        freqs = np.fft.rfftfreq(data.size, d=1.0 / float(sample_rate))

        nyquist = sample_rate / 2.0
        max_freq = float(min(20000.0, nyquist))
        mask = (freqs >= 20.0) & (freqs <= max_freq)
        if not np.any(mask):
            return 20.0, max_freq

        f = freqs[mask]
        p = power[mask]
        total = float(np.sum(p))
        if not np.isfinite(total) or total <= 1e-12:
            return 20.0, max_freq

        cdf = np.cumsum(p) / total
        low = float(f[np.searchsorted(cdf, 0.05, side="left")])
        high = float(f[np.searchsorted(cdf, 0.95, side="left")])

        if high <= low:
            peak_idx = int(np.argmax(p))
            center = float(f[peak_idx])
            low = max(20.0, center * 0.5)
            high = min(max_freq, center * 1.5)

        if high - low < 40.0:
            center = (low + high) / 2.0
            low = max(20.0, center - 25.0)
            high = min(max_freq, center + 25.0)

        return low, high

    def _default_voice_range(self, name: str) -> Tuple[float, float]:
        canonical = self._canonical_voice_name(name)
        ranges = self.VOICE_RANGES.get(canonical, [(20.0, 20000.0)])
        low = min(r[0] for r in ranges)
        high = max(r[1] for r in ranges)
        return float(low), float(high)

    @staticmethod
    def _resample_signal(signal: np.ndarray, original_sr: int, target_sr: int) -> np.ndarray:
        if int(original_sr) == int(target_sr):
            return np.asarray(signal, dtype=np.float32)
        if original_sr <= 0 or target_sr <= 0:
            return np.asarray(signal, dtype=np.float32)
        g = math.gcd(int(original_sr), int(target_sr))
        up = int(target_sr // g)
        down = int(original_sr // g)
        return resample_poly(np.asarray(signal, dtype=np.float32), up, down)

    def _estimate_pitch(self, signal: np.ndarray, sample_rate: int) -> Optional[float]:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size < 512:
            return None

        max_len = int(sample_rate * 2.0)
        if data.size > max_len:
            start = max(0, (data.size - max_len) // 2)
            data = data[start:start + max_len]

        data = data - float(np.mean(data))
        peak = float(np.max(np.abs(data)))
        if not np.isfinite(peak) or peak < 1e-5:
            return None

        window = np.hanning(len(data))
        data = data * window
        n = len(data)
        n_fft = 1 << (n - 1).bit_length()
        spectrum = np.fft.rfft(data, n=n_fft)
        ac = np.fft.irfft(spectrum * np.conj(spectrum))
        ac = ac[:n]

        min_lag = int(sample_rate / self.PITCH_FMAX)
        max_lag = int(sample_rate / self.PITCH_FMIN)
        if max_lag >= len(ac):
            max_lag = len(ac) - 1
        if min_lag < 1 or max_lag <= min_lag:
            return None

        lag = int(min_lag + np.argmax(ac[min_lag:max_lag]))
        if lag <= 0:
            return None
        return float(sample_rate / lag)

    def _classify_pitch(self, pitch_hz: Optional[float]) -> str:
        if pitch_hz is None or not np.isfinite(pitch_hz):
            return "All Male Actors (Odd Numbers)"
        for cutoff, label in self.VOICE_PITCH_BINS:
            if pitch_hz <= cutoff:
                return label
        return "All Male Actors (Odd Numbers)"

    def _bandpass_signal(self, signal: np.ndarray, ranges: List[Tuple[float, float]], sample_rate: int) -> np.ndarray:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size == 0:
            return data

        fft_data = np.fft.rfft(data)
        freqs = np.fft.rfftfreq(data.size, d=1.0 / float(sample_rate))
        mask = np.zeros_like(freqs, dtype=bool)
        for low, high in ranges:
            mask |= (freqs >= float(low)) & (freqs < float(high))
        fft_data[~mask] = 0
        return np.fft.irfft(fft_data, n=data.size)

    @staticmethod
    def _get_model_sample_rate(model) -> Optional[int]:
        for attr in ("sample_rate", "sr", "sample_rate_hz"):
            value = getattr(model, attr, None)
            if value:
                try:
                    return int(value)
                except Exception:
                    pass
        hparams = getattr(model, "hparams", None)
        if hparams is not None:
            value = getattr(hparams, "sample_rate", None)
            if value:
                try:
                    return int(value)
                except Exception:
                    pass
        return None

    @staticmethod
    def _normalize_audio(signal: np.ndarray) -> np.ndarray:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        peak = float(np.max(np.abs(data))) if data.size else 0.0
        if peak <= 1e-8:
            return data
        return data / peak

    def _bandpass_enhance(
        self,
        audio: np.ndarray,
        sample_rate: int,
        low: float = 80.0,
        high: float = 3800.0
    ) -> np.ndarray:
        data = np.asarray(audio, dtype=np.float32).reshape(-1)
        if data.size == 0:
            return data
        nyquist = max(1.0, sample_rate / 2.0)
        lo = float(max(20.0, min(low, nyquist * 0.95)))
        hi = float(max(lo + 10.0, min(high, nyquist * 0.99)))
        if hi <= lo + 1.0:
            return self._normalize_audio(data)
        sos = butter(6, [lo, hi], btype="band", fs=sample_rate, output="sos")
        filtered = sosfilt(sos, data).astype(np.float32)
        return self._normalize_audio(filtered)

    @staticmethod
    def _collect_source_waveforms(estimated) -> List[np.ndarray]:
        est = estimated
        if hasattr(est, "detach"):
            est = est.detach()
        if hasattr(est, "cpu"):
            est = est.cpu()

        est_np = np.asarray(est)
        est_np = np.squeeze(est_np)
        if est_np.ndim == 1:
            return [np.asarray(est_np, dtype=np.float32)]

        if est_np.ndim == 2:
            if est_np.shape[1] <= 4:
                return [np.asarray(est_np[:, i], dtype=np.float32) for i in range(est_np.shape[1])]
            if est_np.shape[0] <= 4:
                return [np.asarray(est_np[i, :], dtype=np.float32) for i in range(est_np.shape[0])]
            return [np.asarray(np.mean(est_np, axis=0), dtype=np.float32)]

        # Prefer axis of size <= 4 as source axis.
        candidate_axes = [i for i, dim in enumerate(est_np.shape) if 1 <= dim <= 4]
        source_axis = candidate_axes[-1] if candidate_axes else int(np.argmin(est_np.shape))
        src_first = np.moveaxis(est_np, source_axis, 0)
        sources: List[np.ndarray] = []
        for i in range(src_first.shape[0]):
            arr = np.asarray(src_first[i], dtype=np.float32)
            arr = np.squeeze(arr)
            if arr.ndim == 0:
                continue
            if arr.ndim == 1:
                sources.append(arr)
                continue
            time_axis = int(np.argmax(arr.shape))
            arr = np.moveaxis(arr, time_axis, -1)
            flat = arr.reshape(-1, arr.shape[-1])
            sources.append(np.asarray(np.mean(flat, axis=0), dtype=np.float32))
        return sources

    def _load_sepformer_model(self, model_name: str):
        try:
            import torch  # type: ignore
            import torchaudio  # type: ignore

            cache_root = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "../../../models/huggingface_cache")
            )
            hub_cache = os.path.join(cache_root, "hub")
            transformers_cache = os.path.join(cache_root, "transformers")
            os.makedirs(hub_cache, exist_ok=True)
            os.makedirs(transformers_cache, exist_ok=True)

            # Keep all model/cache writes inside project workspace to avoid
            # Windows profile permission issues (e.g. C:\Users\...\ .cache).
            os.environ["HF_HOME"] = cache_root
            os.environ["HUGGINGFACE_HUB_CACHE"] = hub_cache
            os.environ["TRANSFORMERS_CACHE"] = transformers_cache
            os.environ.setdefault("TORCH_HOME", os.path.join(cache_root, "torch"))

            # SpeechBrain <=0.5.x expects torchaudio backend APIs that were
            # removed in recent torchaudio releases.
            if not hasattr(torchaudio, "set_audio_backend"):
                def _noop_set_audio_backend(*args, **kwargs):
                    return None
                torchaudio.set_audio_backend = _noop_set_audio_backend  # type: ignore[attr-defined]

            if not hasattr(torchaudio, "get_audio_backend"):
                def _noop_get_audio_backend():
                    return "soundfile"
                torchaudio.get_audio_backend = _noop_get_audio_backend  # type: ignore[attr-defined]

            if not hasattr(torchaudio, "list_audio_backends"):
                def _noop_list_audio_backends():
                    return ["soundfile"]
                torchaudio.list_audio_backends = _noop_list_audio_backends  # type: ignore[attr-defined]

            try:
                from speechbrain.pretrained import SepformerSeparation as Separator  # type: ignore
            except Exception:
                from speechbrain.inference.separation import SepformerSeparation as Separator  # type: ignore

            self._patch_speechbrain_fetch_copy_mode()
        except Exception as exc:
            raise RuntimeError(
                "SpeechBrain SepFormer is not available. Install torch/torchaudio/speechbrain first."
            ) from exc

        device = "cuda" if torch.cuda.is_available() else "cpu"
        savedir_name = model_name.replace("/", "_")
        savedir = os.path.join(
            os.path.dirname(__file__),
            "../../../models/sepformer",
            savedir_name
        )
        os.makedirs(savedir, exist_ok=True)
        source_ref = model_name
        try:
            import huggingface_hub  # type: ignore

            source_path = str(model_name or "")
            if source_path and not os.path.isdir(source_path) and "/" in source_path:
                local_repo_dir = os.path.abspath(
                    os.path.join(
                        os.path.dirname(__file__),
                        "../../../models/sepformer_repo",
                        source_path.replace("/", "__")
                    )
                )
                os.makedirs(local_repo_dir, exist_ok=True)

                # Download the repository locally without symlinks to avoid
                # Windows privilege requirements.
                if not os.path.exists(os.path.join(local_repo_dir, "hyperparams.yaml")):
                    huggingface_hub.snapshot_download(
                        repo_id=source_path,
                        local_dir=local_repo_dir,
                        local_dir_use_symlinks=False,
                        resume_download=True,
                        cache_dir=os.environ.get("HUGGINGFACE_HUB_CACHE"),
                    )
                source_ref = local_repo_dir
        except Exception:
            source_ref = model_name

        model = Separator.from_hparams(source=source_ref, savedir=savedir, run_opts={"device": device})
        return model, torch, device

    def _patch_speechbrain_fetch_copy_mode(self) -> None:
        try:
            import huggingface_hub  # type: ignore
            from speechbrain.pretrained import fetching as sb_fetching  # type: ignore
            from speechbrain.pretrained import interfaces as sb_interfaces  # type: ignore
        except Exception:
            return

        if getattr(sb_fetching, "_sigeq_no_symlink_patch", False):
            return

        original_fetch = sb_fetching.fetch

        def _copy_fetch(
            filename,
            source,
            savedir="./pretrained_model_checkpoints",
            overwrite=False,
            save_filename=None,
            use_auth_token=False,
            revision=None,
            cache_dir=None,
            silent_local_fetch=False,
        ):
            try:
                return original_fetch(
                    filename=filename,
                    source=source,
                    savedir=savedir,
                    overwrite=overwrite,
                    save_filename=save_filename,
                    use_auth_token=use_auth_token,
                    revision=revision,
                    cache_dir=cache_dir,
                    silent_local_fetch=silent_local_fetch,
                )
            except OSError as exc:
                msg = str(exc).lower()
                winerr = getattr(exc, "winerror", None)
                if winerr not in (5, 1314) and "symlink" not in msg and "privilege" not in msg and "access is denied" not in msg:
                    raise

            if save_filename is None:
                save_filename = filename

            save_dir_path = pathlib.Path(savedir)
            save_dir_path.mkdir(parents=True, exist_ok=True)
            destination = save_dir_path / save_filename

            if destination.exists() and not overwrite:
                return destination

            if destination.exists():
                try:
                    destination.unlink()
                except Exception:
                    pass

            source_path = str(source or "")
            if pathlib.Path(source_path).is_dir():
                local_src = pathlib.Path(source_path) / filename
                if not local_src.exists():
                    raise ValueError(f"File not found in local source directory: {local_src}")
                shutil.copyfile(str(local_src), str(destination))
                return destination

            if source_path.startswith("http://") or source_path.startswith("https://"):
                urllib.request.urlretrieve(f"{source_path}/{filename}", str(destination))
                return destination

            fetched_file = huggingface_hub.hf_hub_download(
                repo_id=source,
                filename=filename,
                use_auth_token=use_auth_token,
                revision=revision,
                cache_dir=cache_dir,
            )
            shutil.copyfile(str(fetched_file), str(destination))
            return destination

        sb_fetching.fetch = _copy_fetch
        sb_interfaces.fetch = _copy_fetch
        sb_fetching._sigeq_no_symlink_patch = True

    def _get_sepformer_runtime(self, model_name: str):
        if self._sepformer_model is None or self._sepformer_model_name != model_name:
            model, torch_module, device = self._load_sepformer_model(model_name)
            self._sepformer_model = model
            self._sepformer_model_name = model_name
            self._sepformer_device = device
            return model, torch_module, device

        import torch  # type: ignore
        return self._sepformer_model, torch, self._sepformer_device

    def _separate_two_with_sepformer(
        self,
        signal: np.ndarray,
        sample_rate: int,
        model
    ) -> Tuple[np.ndarray, np.ndarray]:
        sig = np.asarray(signal, dtype=np.float32).reshape(-1)
        estimated = None

        # Prefer tensor-based inference to avoid torchaudio/torchcodec file loaders.
        try:
            import torch  # type: ignore

            mixture = torch.from_numpy(sig).unsqueeze(0)
            model_device = getattr(model, "device", "cpu")
            if model_device:
                mixture = mixture.to(model_device)
            with torch.no_grad():
                estimated = model.separate_batch(mixture)
        except Exception:
            estimated = None

        if estimated is None:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                sf.write(tmp_path, sig, int(sample_rate))
                estimated = model.separate_file(path=tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        sources = self._collect_source_waveforms(estimated)
        if len(sources) < 2:
            if not sources:
                zero = np.zeros_like(sig, dtype=np.float32)
                return zero, zero
            src = self._fit_signal_length(sources[0], len(sig))
            return self._normalize_audio(src), np.zeros_like(src)

        s1 = self._fit_signal_length(sources[0], len(sig))
        s2 = self._fit_signal_length(sources[1], len(sig))
        return self._normalize_audio(s1), self._normalize_audio(s2)

    def _separate_with_sepformer_cascade(
        self,
        signal: np.ndarray,
        sample_rate: int,
        model_name: str
    ) -> List[np.ndarray]:
        # Notebook architecture for Human AI mode: SepFormer WSJ02mix 2-speaker separation.
        model, _, _ = self._get_sepformer_runtime(model_name)
        target_sr = self.SEPFORMER_SAMPLE_RATE

        working = np.asarray(signal, dtype=np.float32).reshape(-1)
        if int(sample_rate) != int(target_sr):
            working = self._resample_signal(working, sample_rate, target_sr)
        working = self._normalize_audio(working)

        spk1, spk2 = self._separate_two_with_sepformer(working, target_sr, model)
        separated = [spk1, spk2]
        separated = [self._bandpass_enhance(s, target_sr) for s in separated]

        if int(sample_rate) != int(target_sr):
            separated = [self._resample_signal(s, target_sr, sample_rate) for s in separated]

        return [self._fit_signal_length(self._normalize_audio(s), len(signal)) for s in separated]

    def _derive_notebook_slider_range(self, signal: np.ndarray, sample_rate: int, fallback_name: str) -> Tuple[float, float]:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size < 32:
            return self._default_voice_range(fallback_name)

        fft_mag = np.abs(np.fft.rfft(data))
        freqs = np.fft.rfftfreq(data.size, 1.0 / float(sample_rate))
        nyquist = float(sample_rate / 2.0)

        energies: List[Tuple[float, float, float]] = []
        for low, high in self.NOTEBOOK_BANDS:
            hi = min(float(high), nyquist)
            lo = float(max(20.0, low))
            if hi <= lo:
                energies.append((lo, hi, 0.0))
                continue
            mask = (freqs >= lo) & (freqs <= hi)
            val = float(np.sum(np.square(fft_mag[mask]))) if np.any(mask) else 0.0
            energies.append((lo, hi, val))

        total = float(sum(v for _, _, v in energies))
        if not np.isfinite(total) or total <= 1e-12:
            return self._default_voice_range(fallback_name)

        normalized = [(lo, hi, (v / total)) for lo, hi, v in energies]
        active = [(lo, hi) for lo, hi, w in normalized if w > self.NOTEBOOK_ACTIVE_BAND_THRESHOLD]
        if not active:
            dominant = max(normalized, key=lambda item: item[2])
            active = [(dominant[0], dominant[1])]

        low = float(min(lo for lo, _ in active))
        high = float(max(hi for _, hi in active))
        if high <= low + 1.0:
            return self._default_voice_range(fallback_name)
        return low, high

    def _derive_label_aware_slider_range(
        self,
        signal: np.ndarray,
        sample_rate: int,
        label: str
    ) -> Tuple[float, float]:
        canonical = self._canonical_voice_name(label)

        # Base estimate from notebook energy-band logic.
        base_low, base_high = self._derive_notebook_slider_range(signal, sample_rate, canonical)

        # Percentile spectral estimate keeps range tied to actual separated content.
        est_low, est_high = self._estimate_frequency_range(signal, sample_rate)

        # Label-specific hints prevent different speakers from collapsing to one broad range.
        hint_low, hint_high = self.LABEL_SLIDER_HINTS.get(canonical, self._default_voice_range(canonical))

        low = max(float(hint_low), float(min(base_low, est_low)))
        high = min(float(hint_high), float(max(base_high, est_high)))

        if not np.isfinite(low) or not np.isfinite(high) or high <= low + 20.0:
            low, high = float(hint_low), float(hint_high)

        return float(low), float(high)

    def _pick_f0_candidates(
        self,
        signal: np.ndarray,
        sample_rate: int,
        max_candidates: int = 4
    ) -> List[float]:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size < 1024:
            return []

        n = len(data)
        window = np.hanning(n)
        spec = np.abs(np.fft.rfft(data * window))
        freqs = np.fft.rfftfreq(n, d=1.0 / float(sample_rate))

        band_mask = (freqs >= 70.0) & (freqs <= 350.0)
        if not np.any(band_mask):
            return []

        band_spec = spec[band_mask]
        band_freqs = freqs[band_mask]
        if band_spec.size < 8:
            return []

        peak_height = float(np.max(band_spec) * 0.15)
        min_dist_hz = 20.0
        hz_per_bin = float((band_freqs[-1] - band_freqs[0]) / max(1, len(band_freqs) - 1))
        min_dist_bins = max(1, int(round(min_dist_hz / max(1e-6, hz_per_bin))))

        peak_idx, props = find_peaks(band_spec, height=peak_height, distance=min_dist_bins)
        if peak_idx.size == 0:
            top_idx = np.argsort(band_spec)[::-1][:max_candidates]
            return sorted(float(band_freqs[i]) for i in top_idx)

        peak_heights = props.get("peak_heights", np.zeros_like(peak_idx, dtype=float))
        ranked = sorted(
            [(float(peak_heights[i]), float(band_freqs[idx])) for i, idx in enumerate(peak_idx)],
            key=lambda x: x[0],
            reverse=True
        )

        selected: List[float] = []
        for _, f0 in ranked:
            if all(abs(f0 - s) >= 18.0 for s in selected):
                selected.append(f0)
            if len(selected) >= max_candidates:
                break
        return sorted(selected)

    def _fallback_separate_by_harmonics(
        self,
        signal: np.ndarray,
        sample_rate: int,
        labels: List[str]
    ) -> Optional[Dict[str, np.ndarray]]:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size < 1024:
            return None

        f0_candidates = self._pick_f0_candidates(data, sample_rate, max_candidates=min(4, len(labels)))
        if len(f0_candidates) < 2:
            return None

        nperseg = min(2048, max(512, 1 << int(np.floor(np.log2(max(512, min(len(data), 4096)))))))
        noverlap = int(nperseg * 0.75)
        if noverlap >= nperseg:
            noverlap = nperseg // 2

        freqs, _, Zxx = stft(
            data,
            fs=float(sample_rate),
            window="hann",
            nperseg=nperseg,
            noverlap=noverlap,
            boundary="zeros",
            padded=True
        )
        if Zxx.size == 0:
            return None

        templates = []
        max_freq = float(min(sample_rate / 2.0, 4000.0))
        for f0 in f0_candidates:
            tpl = np.zeros_like(freqs, dtype=np.float32)
            harmonic = float(f0)
            while harmonic <= max_freq:
                bw = max(20.0, harmonic * 0.035)
                tpl += np.exp(-0.5 * ((freqs - harmonic) / bw) ** 2).astype(np.float32)
                harmonic += float(f0)
            templates.append(tpl)

        if not templates:
            return None

        template_stack = np.stack(templates, axis=0) + 1e-8
        template_sum = np.sum(template_stack, axis=0, keepdims=True)
        masks = template_stack / template_sum

        source_signals: List[np.ndarray] = []
        for k in range(masks.shape[0]):
            masked = Zxx * masks[k][:, np.newaxis]
            _, rec = istft(
                masked,
                fs=float(sample_rate),
                window="hann",
                nperseg=nperseg,
                noverlap=noverlap,
                input_onesided=True,
                boundary=True
            )
            rec = self._fit_signal_length(np.asarray(rec, dtype=np.float32), len(data))
            source_signals.append(self._normalize_audio(rec))

        # Map candidates to the notebook labels via nearest target pitch.
        remaining = list(range(len(f0_candidates)))
        assigned: Dict[str, List[int]] = {name: [] for name in labels}
        for label in labels:
            target = self.VOICE_TARGET_PITCH.get(label)
            if target is None or not remaining:
                continue
            best_i = min(remaining, key=lambda i: abs(float(f0_candidates[i]) - float(target)))
            assigned[label].append(best_i)
            remaining.remove(best_i)

        for i in remaining:
            nearest = min(labels, key=lambda name: abs(float(f0_candidates[i]) - float(self.VOICE_TARGET_PITCH.get(name, f0_candidates[i]))))
            assigned[nearest].append(i)

        out: Dict[str, np.ndarray] = {}
        for label in labels:
            idxs = assigned.get(label, [])
            if not idxs:
                out[label] = np.zeros(len(data), dtype=np.float32)
                continue
            stacked = np.stack([source_signals[i] for i in idxs], axis=0)
            out[label] = np.sum(stacked, axis=0).astype(np.float32)
            out[label] = self._normalize_audio(out[label])

        return out

    def _match_sources_to_labels(
        self,
        sources: List[np.ndarray],
        labels: List[str],
        sample_rate: int
    ) -> Dict[str, np.ndarray]:
        fitted = [self._fit_signal_length(src, len(sources[0])) for src in sources] if sources else []
        if not fitted:
            return {name: np.zeros(1, dtype=np.float32) for name in labels}

        infos = []
        for src in fitted:
            pitch = self._estimate_pitch(src, sample_rate)
            infos.append({
                "signal": src,
                "pitch": pitch,
                "rms": self._rms(src)
            })

        remaining = set(range(len(infos)))
        assignments: Dict[str, List[int]] = {name: [] for name in labels}

        # First pass: ensure each label gets a unique best-matching source.
        for label in labels:
            target = self.VOICE_TARGET_PITCH.get(label)
            best_idx = None
            best_score = float("inf")

            if target is not None:
                for idx in list(remaining):
                    pitch = infos[idx]["pitch"]
                    if pitch is None or not np.isfinite(pitch):
                        continue
                    score = abs(float(pitch) - float(target))
                    if score < best_score:
                        best_score = score
                        best_idx = idx

            if best_idx is None and remaining:
                best_idx = max(remaining, key=lambda i: infos[i]["rms"])

            if best_idx is not None:
                assignments[label].append(best_idx)
                remaining.discard(best_idx)

        # Extra sources (if any) are merged into nearest pitch class.
        for idx in list(remaining):
            pitch = infos[idx]["pitch"]
            if pitch is not None and np.isfinite(pitch):
                label = min(labels, key=lambda name: abs(float(pitch) - self.VOICE_TARGET_PITCH.get(name, float(pitch))))
            else:
                label = max(labels, key=lambda name: sum(infos[i]["rms"] for i in assignments[name]) if assignments[name] else 0.0)
            assignments[label].append(idx)

        output: Dict[str, np.ndarray] = {}
        base_len = len(fitted[0])
        for label in labels:
            idxs = assignments.get(label, [])
            if not idxs:
                output[label] = np.zeros(base_len, dtype=np.float32)
                continue
            stack = np.stack([infos[i]["signal"] for i in idxs], axis=0)
            output[label] = np.sum(stack, axis=0).astype(np.float32)
        return output

    def separate_with_ai(
        self,
        signal: np.ndarray,
        voice_names: Optional[List[str]] = None,
        sample_rate: float = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        sr_int = self._to_int_sample_rate(sample_rate)

        input_signal = np.asarray(signal, dtype=np.float32).reshape(-1)
        if input_signal.size == 0:
            raise ValueError("Signal is empty")

        model_key = str(model_name or self.SEPFORMER_MODEL_DEFAULT).strip() or self.SEPFORMER_MODEL_DEFAULT
        labels = [self._canonical_voice_name(name) for name in (voice_names or list(self.VOICE_RANGES.keys()))]

        fallback = False
        warning = None
        speakers: List[np.ndarray] = []

        try:
            speakers = self._separate_with_sepformer_cascade(input_signal, sr_int, model_key)
        except Exception as exc:
            fallback = True
            warning = f"SepFormer unavailable ({exc}). Falling back to DSP band isolation."

        components = []
        if not fallback and speakers:
            matched = self._match_sources_to_labels(speakers, labels, sr_int)
            for name in labels:
                combined = self._fit_signal_length(matched.get(name, np.zeros_like(input_signal)), len(input_signal))
                rms_val = self._rms(combined)
                low, high = (
                    self._derive_label_aware_slider_range(combined, sr_int, name)
                    if rms_val > 1e-8
                    else self._default_voice_range(name)
                )
                display_name = self._display_voice_name(name)
                components.append({
                    "name": display_name,
                    "source": name,
                    "signal": combined,
                    "low": float(low),
                    "high": float(high),
                    "rms": float(rms_val)
                })
        else:
            harmonic_fallback = self._fallback_separate_by_harmonics(input_signal, sr_int, labels)
            for name in labels:
                if harmonic_fallback is not None and name in harmonic_fallback:
                    isolated = self._fit_signal_length(harmonic_fallback[name], len(input_signal))
                else:
                    ranges = self.FALLBACK_VOICE_ISOLATION_RANGES.get(name) or self.VOICE_RANGES.get(name, [(20.0, 20000.0)])
                    isolated = self._bandpass_signal(input_signal, ranges, sr_int)
                isolated = self._normalize_audio(isolated)
                rms_val = self._rms(isolated)
                low, high = self._default_voice_range(name)
                display_name = self._display_voice_name(name)
                components.append({
                    "name": display_name,
                    "source": name,
                    "signal": isolated,
                    "low": float(low),
                    "high": float(high),
                    "rms": float(rms_val)
                })

        return {
            "model_name": model_key,
            "sample_rate": sr_int,
            "components": components,
            "processing_time": time.time() - start_time,
            "fallback": fallback,
            "warning": warning
        }

humans_service = HumansModeService()
