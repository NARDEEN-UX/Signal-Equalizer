import math
import os
import sys
import tempfile
import numpy as np
from scipy.fft import fft, fftfreq
from scipy.signal import resample_poly
import time
from typing import List, Tuple, Optional, Dict, Any
import pywt
import soundfile as sf


class HumansModeService:
    """Service for human voice mode signal processing"""
    
    # Exact Fundamental Frequency Ranges for voice types
    VOICE_RANGES = {
        "Male Voice":     [(85, 180)],   # Adult males 85-180 Hz
        "Female Voice":   [(165, 255)],  # Adult females 165-255 Hz
        "Young Speaker":  [(250, 450)],  # Children 250-450 Hz
        "Old Speaker":    [(80, 150)],   # Older adults (typically overlaps male low/mid)
    }

    # Pitch bins (Hz) for heuristic voice classification.
    VOICE_PITCH_BINS = (
        (140.0, "Old Speaker"),
        (190.0, "Male Voice"),
        (260.0, "Female Voice"),
        (float("inf"), "Young Speaker")
    )
    PITCH_FMIN = 50.0
    PITCH_FMAX = 500.0

    # Canonical mapping with aliases to keep legacy presets compatible.
    VOICE_NAME_ALIASES = {
        "male voice": "Male Voice",
        "male": "Male Voice",
        "voice 1": "Male Voice",
        "female voice": "Female Voice",
        "female": "Female Voice",
        "voice 2": "Female Voice",
        "young speaker": "Young Speaker",
        "young": "Young Speaker",
        "voice 3": "Young Speaker",
        "old speaker": "Old Speaker",
        "old": "Old Speaker",
        "voice 4": "Old Speaker",
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
        self.default_sample_rate = 22050  # Default SR for voice
        self._multidecoder_model = None
        self._multidecoder_model_name = None
        self._multidecoder_device = "cpu"

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
            input_coeffs, output_coeffs, equalized_signal = self._apply_wavelet_equalization(
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
            if isinstance(band, dict) and 'low' in band and 'high' in band:
                low = float(band.get('low', 20))
                high = float(band.get('high', 20000))
                ranges.append([(low, high)])
            else:
                ranges.append([(20.0, 20000.0)])
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
            return "Male Voice"
        for cutoff, label in self.VOICE_PITCH_BINS:
            if pitch_hz <= cutoff:
                return label
        return "Male Voice"

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

    def _load_multidecoder_model(self, model_name: str):
        try:
            import torch  # type: ignore
        except Exception as exc:
            raise RuntimeError("PyTorch is not installed. Install torch/torchaudio/asteroid first.") from exc

        model = None
        errors = []

        repo_root = os.path.join(os.path.dirname(__file__), "../../../models/multidecoder_dprnn")
        candidate_paths = [
            repo_root,
            os.path.join(repo_root, "Multi-Decoder-DPRNN"),
            os.path.join(repo_root, "asteroid", "egs", "wsj0-mix-var", "Multi-Decoder-DPRNN")
        ]

        for repo_path in candidate_paths:
            if not os.path.isdir(repo_path):
                continue
            if not os.path.isfile(os.path.join(repo_path, "model.py")):
                continue
            sys.path.insert(0, repo_path)
            try:
                from model import MultiDecoderDPRNN  # type: ignore
                model = MultiDecoderDPRNN.from_pretrained(model_name)
                break
            except Exception as exc:
                errors.append(f"local repo ({repo_path}): {exc}")
            finally:
                if sys.path[0] == repo_path:
                    sys.path.pop(0)

        if model is None:
            try:
                from asteroid.models import MultiDecoderDPRNN  # type: ignore
                model = MultiDecoderDPRNN.from_pretrained(model_name)
            except Exception as exc:
                errors.append(f"asteroid.models.MultiDecoderDPRNN: {exc}")

        if model is None:
            try:
                from asteroid.models import BaseModel  # type: ignore
                model = BaseModel.from_pretrained(model_name)
            except Exception as exc:
                errors.append(f"asteroid BaseModel: {exc}")

        if model is None:
            details = "; ".join(errors) if errors else "unknown error"
            raise RuntimeError(
                "Could not load MultiDecoderDPRNN. "
                "Install asteroid and/or clone the Multi-Decoder-DPRNN repo into "
                "`backend/models/multidecoder_dprnn` so `model.py` is available. "
                f"Details: {details}"
            )

        if hasattr(model, "eval"):
            model.eval()

        device = "cuda" if torch.cuda.is_available() else "cpu"
        if hasattr(model, "to"):
            model = model.to(device)

        return model, torch, device

    def _get_multidecoder_runtime(self, model_name: str):
        if self._multidecoder_model is None or self._multidecoder_model_name != model_name:
            model, torch_module, device = self._load_multidecoder_model(model_name)
            self._multidecoder_model = model
            self._multidecoder_model_name = model_name
            self._multidecoder_device = device
            return model, torch_module, device

        import torch  # type: ignore
        return self._multidecoder_model, torch, self._multidecoder_device

    @staticmethod
    def _normalize_multidecoder_output(estimated, torch_module) -> List[np.ndarray]:
        est = estimated
        if hasattr(est, "detach"):
            est = est.detach()
        if torch_module is not None and hasattr(torch_module, "Tensor") and isinstance(est, torch_module.Tensor):
            est = est.cpu()

        est_np = np.asarray(est)
        if est_np.ndim == 2:
            if est_np.shape[0] <= 8:
                return [np.asarray(est_np[i], dtype=np.float32) for i in range(est_np.shape[0])]
            return [np.asarray(est_np[0], dtype=np.float32)]

        if est_np.ndim == 3:
            # [sources, channels, time] or [channels, sources, time]
            if est_np.shape[0] <= est_np.shape[1]:
                src = np.mean(est_np, axis=1)
            else:
                src = np.mean(est_np.transpose(1, 0, 2), axis=1)
            return [np.asarray(src[i], dtype=np.float32) for i in range(src.shape[0])]

        raise RuntimeError(f"Unexpected MultiDecoderDPRNN output shape: {est_np.shape}")

    def _separate_with_multidecoder(
        self,
        signal: np.ndarray,
        sample_rate: int,
        model_name: str
    ) -> List[np.ndarray]:
        model, torch_module, device = self._get_multidecoder_runtime(model_name)
        target_sr = self._get_model_sample_rate(model) or sample_rate

        working_signal = signal
        if int(target_sr) != int(sample_rate):
            working_signal = self._resample_signal(signal, sample_rate, target_sr)

        mixture = torch_module.from_numpy(np.asarray(working_signal, dtype=np.float32))
        if mixture.ndim == 1:
            mixture = mixture.unsqueeze(0)

        mixture = mixture.to(device)
        with torch_module.no_grad():
            estimated = model.separate(mixture)

        sources = self._normalize_multidecoder_output(estimated, torch_module)
        if int(target_sr) != int(sample_rate):
            sources = [self._resample_signal(src, target_sr, sample_rate) for src in sources]

        return sources

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

        model_key = str(model_name or "JunzheJosephZhu/MultiDecoderDPRNN").strip() or "JunzheJosephZhu/MultiDecoderDPRNN"
        labels = [self._canonical_voice_name(name) for name in (voice_names or list(self.VOICE_RANGES.keys()))]

        fallback = False
        warning = None
        speakers: List[np.ndarray] = []

        try:
            speakers = self._separate_with_multidecoder(input_signal, sr_int, model_key)
        except Exception as exc:
            fallback = True
            warning = f"MultiDecoderDPRNN unavailable ({exc}). Falling back to DSP band isolation."

        components = []
        if not fallback and speakers:
            category_signals: Dict[str, List[np.ndarray]] = {name: [] for name in labels}
            for speaker in speakers:
                speaker = self._fit_signal_length(speaker, len(input_signal))
                pitch = self._estimate_pitch(speaker, sr_int)
                category = self._classify_pitch(pitch)
                if category not in category_signals:
                    category_signals[category] = []
                category_signals[category].append(speaker)

            for name in labels:
                items = category_signals.get(name, [])
                if items:
                    stacked = np.stack(items, axis=0)
                    combined = np.sum(stacked, axis=0)
                else:
                    combined = np.zeros_like(input_signal)
                rms_val = self._rms(combined)
                low, high = self._estimate_frequency_range(combined, sr_int) if rms_val > 1e-8 else self._default_voice_range(name)
                components.append({
                    "name": name,
                    "source": name,
                    "signal": combined.tolist(),
                    "low": float(low),
                    "high": float(high),
                    "rms": float(rms_val)
                })
        else:
            for name in labels:
                ranges = self.VOICE_RANGES.get(name, [(20.0, 20000.0)])
                filtered = self._bandpass_signal(input_signal, ranges, sr_int)
                rms_val = self._rms(filtered)
                low, high = self._default_voice_range(name)
                components.append({
                    "name": name,
                    "source": name,
                    "signal": filtered.tolist(),
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
