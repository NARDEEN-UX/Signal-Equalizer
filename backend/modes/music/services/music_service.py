"""
Music Mode Service
Handles musical instrument separation and equalization.
"""

import time
from typing import List, Optional, Tuple, Dict, Any

import numpy as np
from scipy.fft import fft, fftfreq
import pywt


class MusicModeService:
    """Service for music mode signal processing with configurable bands."""

    # DSP fallback ranges aligned with standard Demucs stems.
    INSTRUMENT_RANGES = {
        "drums": [(20, 200), (200, 500)],
        "bass": [(30, 150), (150, 300)],
        "guitar": [(80, 600), (600, 1200)],
        "piano": [(28, 500), (500, 4186)],
        "vocals": [(85, 1000), (1000, 3400)],
        "other": [(200, 2000), (2000, 8000)]
    }
    DEMUCS_SOURCE_ORDER = ("drums", "bass", "vocals", "guitar", "piano", "other")

    ALLOWED_WAVELETS = {
        "haar", "db4", "db6", "db8", "sym5", "sym8", "coif3", "bior3.5", "dmey"
    }

    DEMUCS_MODEL_DEFAULT = "htdemucs_6s"

    def __init__(self):
        self.default_sample_rate = 44100
        self._demucs_model = None
        self._demucs_model_name = None
        self._demucs_device = "cpu"

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
        Process signal with instrument-based equalization.
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
                instrument_names=instrument_names,
                bands=bands,
                count=len(gains)
            )
            equalized_signal = self._apply_instrument_equalization(signal, freq_ranges, gains, sr)
        else:
            wavelet_name = self._validate_wavelet(wavelet)
            max_level = pywt.dwt_max_level(len(signal), pywt.Wavelet(wavelet_name).dec_len)
            actual_level = max(1, min(int(wavelet_level or 6), max_level))
            freq_ranges = self._resolve_frequency_ranges(
                instrument_names=instrument_names,
                bands=bands,
                count=len(gains)
            )
            input_coeffs, output_coeffs, equalized_signal, band_waveforms = self._compute_music_wavelet_coeffs(
                signal=signal,
                freq_ranges=freq_ranges,
                gains=gains,
                wavelet=wavelet_name,
                level=actual_level,
                sample_rate=sr,
                sliders_wavelet=sliders_wavelet,
                band_names=instrument_names
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
            for sub_ranges, gain in zip(freq_ranges, gains):
                for low, high in sub_ranges:
                    if self._ranges_overlap(lv_low, lv_high, float(low), float(high)):
                        matched.append(self._clamp_gain(gain))
                        break

            base_gain = self._combine_overlap_gains(matched)
            if sliders_wavelet is not None and lv - 1 < len(sliders_wavelet):
                base_gain *= self._clamp_gain(sliders_wavelet[lv - 1])

            level_gains[lv] = self._clamp_gain(base_gain)

        return level_gains

    def _compute_music_wavelet_coeffs(
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
        reconstructed = np.asarray(reconstructed, dtype=float)
        reconstructed = self._fit_signal_length(reconstructed, len(signal))

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
        reconstructed = np.asarray(reconstructed, dtype=float)
        return self._fit_signal_length(reconstructed, signal_len)

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
        total_bands = len(freq_ranges)

        for idx in range(total_bands):
            sub_ranges = freq_ranges[idx] if idx < len(freq_ranges) else []
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

            if band_names and idx < len(band_names):
                name = str(band_names[idx])
            else:
                name = f"Band {idx + 1}"

            waveforms.append({
                "band_index": idx,
                "name": name,
                "low": low,
                "high": high,
                "levels": active_levels,
                "input": in_sig.tolist(),
                "output": out_sig.tolist()
            })

        return waveforms

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
        instrument_names: List[str],
        bands: Optional[List[Dict]],
        count: int
    ) -> List[List[Tuple[float, float]]]:
        if bands:
            ranges = self._get_frequency_ranges_from_bands(bands)
        else:
            ranges = self._get_frequency_ranges(instrument_names)

        if len(ranges) < count:
            ranges.extend([[(20.0, 20000.0)]] * (count - len(ranges)))
        return ranges[:count]

    @staticmethod
    def _canonical_instrument_name(name: str) -> str:
        key = str(name or "").strip().lower()
        if key == "others":
            return "other"
        return key

    def _get_frequency_ranges(self, instrument_names: List[str]) -> List[List[Tuple[float, float]]]:
        ranges = []
        for name in instrument_names:
            canonical = self._canonical_instrument_name(name)
            if canonical in self.INSTRUMENT_RANGES:
                ranges.append(list(self.INSTRUMENT_RANGES[canonical]))
            else:
                ranges.append([(20.0, 20000.0)])
        return ranges

    def _apply_instrument_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[List[Tuple[float, float]]],
        gains: List[float],
        sample_rate: float
    ) -> np.ndarray:
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        abs_freqs = np.abs(freqs)

        mask_rows = []
        gain_rows = []
        for sub_ranges, gain in zip(freq_ranges, gains):
            mask = np.zeros(len(freqs), dtype=bool)
            for low, high in sub_ranges:
                low_f = float(low)
                high_f = float(high)
                if high_f <= low_f:
                    continue
                mask |= (abs_freqs >= low_f) & (abs_freqs < high_f)
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

        equalized = np.real(np.fft.ifft(fft_data))
        return equalized

    def _compute_fft_data(self, signal: np.ndarray, sample_rate: float) -> dict:
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

        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12))
        Sxx_db = np.clip(Sxx_db, -120.0, 0.0)

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

    def separate_with_demucs(
        self,
        signal: np.ndarray,
        instrument_names: List[str],
        sample_rate: float = None,
        model_name: str = None
    ) -> Dict[str, Any]:
        """
        Separate a music mixture using Demucs and return components aligned to UI instrument names.
        """
        start_time = time.time()
        sr_int = self._to_int_sample_rate(sample_rate)

        input_signal = np.asarray(signal, dtype=np.float32).reshape(-1)
        if input_signal.size == 0:
            raise ValueError("Signal is empty")

        model_key = str(model_name or self.DEMUCS_MODEL_DEFAULT).strip() or self.DEMUCS_MODEL_DEFAULT
        model, torch, apply_model, convert_audio, device = self._get_demucs_runtime(model_key)

        mixture = torch.from_numpy(input_signal).unsqueeze(0).unsqueeze(0)
        mixture = convert_audio(mixture, sr_int, int(model.samplerate), int(model.audio_channels))
        mixture = mixture.to(device)

        with torch.no_grad():
            estimated_raw = apply_model(
                model,
                mixture,
                device=device,
                split=True,
                overlap=0.25,
                progress=False
            )
        estimated_sources = self._normalize_demucs_output(
            estimated_raw=estimated_raw,
            source_count=len(getattr(model, "sources", []) or [])
        )

        source_map: Dict[str, np.ndarray] = {}
        for idx, source_name in enumerate(model.sources):
            stem = estimated_sources[idx].detach().cpu().unsqueeze(0)
            stem = convert_audio(stem, int(model.samplerate), sr_int, 1)
            stem_np = stem.squeeze(0).squeeze(0).numpy()
            canonical = self._canonical_instrument_name(str(source_name))
            source_map[canonical] = self._fit_signal_length(stem_np, len(input_signal))

        requested_components = []
        requested_names = [
            self._canonical_instrument_name(name)
            for name in (instrument_names or list(source_map.keys()))
            if self._canonical_instrument_name(name) in source_map
        ]
        if not requested_names:
            requested_names = [name for name in self.DEMUCS_SOURCE_ORDER if name in source_map]
            if not requested_names:
                requested_names = list(source_map.keys())

        for name in requested_names:
            component_signal = source_map[name]
            low, high = self._estimate_frequency_range(component_signal, sr_int)
            requested_components.append({
                "name": name,
                "source": name,
                "signal": component_signal.tolist(),
                "low": float(low),
                "high": float(high),
                "rms": self._rms(component_signal)
            })

        return {
            "model_name": model_key,
            "sample_rate": sr_int,
            "components": requested_components,
            "processing_time": time.time() - start_time
        }

    def _to_int_sample_rate(self, sample_rate: Optional[float]) -> int:
        raw = sample_rate if sample_rate is not None else self.default_sample_rate
        try:
            value = int(round(float(raw)))
        except Exception as exc:
            raise ValueError(f"Invalid sample_rate '{sample_rate}'") from exc
        return max(1, value)

    @staticmethod
    def _rms(signal: np.ndarray) -> float:
        data = np.asarray(signal, dtype=np.float32).reshape(-1)
        if data.size == 0:
            return 0.0
        return float(np.sqrt(np.mean(np.square(data))))

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

    @staticmethod
    def _normalize_demucs_output(estimated_raw, source_count: int):
        estimated = estimated_raw[0] if isinstance(estimated_raw, (list, tuple)) else estimated_raw

        if getattr(estimated, "ndim", None) == 4:
            estimated = estimated[0]

        if getattr(estimated, "ndim", None) != 3:
            raise RuntimeError(
                f"Unexpected Demucs output shape: {tuple(getattr(estimated, 'shape', []))}"
            )

        if source_count > 0 and estimated.shape[0] != source_count and estimated.shape[1] == source_count:
            estimated = estimated.permute(1, 0, 2)

        if source_count > 0 and estimated.shape[0] != source_count:
            raise RuntimeError(
                f"Could not align Demucs source axis. Got shape {tuple(estimated.shape)} for {source_count} sources."
            )

        return estimated

    def _get_demucs_runtime(self, model_name: str):
        try:
            import torch  # type: ignore
            from demucs.apply import apply_model  # type: ignore
            from demucs.audio import convert_audio  # type: ignore
            from demucs.pretrained import get_model  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "Demucs is not installed. Install backend dependencies including demucs/torch first."
            ) from exc

        if self._demucs_model is None or self._demucs_model_name != model_name:
            try:
                model = get_model(model_name)
            except Exception as exc:
                raise RuntimeError(f"Failed to load Demucs model '{model_name}': {exc}") from exc

            device = "cuda" if torch.cuda.is_available() else "cpu"
            model.to(device)
            model.eval()

            self._demucs_model = model
            self._demucs_model_name = model_name
            self._demucs_device = device

        return self._demucs_model, torch, apply_model, convert_audio, self._demucs_device

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


music_service = MusicModeService()
