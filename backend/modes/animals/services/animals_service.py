import numpy as np
from scipy import signal
import json
import time
from typing import List, Tuple, Optional, Dict
import pywt
from scipy.fft import fft, fftfreq


class AnimalModeSeparator:
    """
    Separate animal sounds using frequency-based decomposition
    Supports 5 animal categories with scientifically accurate frequency ranges
    """
    
    # 5-Band Animal Configuration
    # 5-Band Animal Configuration (Vocalization/sound production ranges from bioacoustics research)
    # These ranges naturally overlap because real animal sounds overlap in frequency.
    ANIMAL_RANGES = {
        'large_mammals': {
            'id': 'animal-3',
            'name': 'Large Mammals',
            'low': 5,
            'high': 500,
            'examples': 'Elephant, Whale, Horse, Cattle'
        },
        'canines': {
            'id': 'animal-1',
            'name': 'Canines',
            'low': 150,
            'high': 2000,
            'examples': 'Dog, Wolf, Hyena, Fox'
        },
        'felines': {
            'id': 'animal-2',
            'name': 'Felines',
            'low': 48,
            'high': 10000,
            'examples': 'Cat, Lion, Tiger, Leopard'
        },
        'songbirds': {
            'id': 'animal-0',
            'name': 'Songbirds',
            'low': 1000,
            'high': 8000,
            'examples': 'Sparrow, Canary, Warbler, Finch'
        },
        'insects': {
            'id': 'animal-4',
            'name': 'Insects',
            'low': 600,
            'high': 20000,
            'examples': 'Cricket, Cicada, Bee, Grasshopper'
        }
    }
    
    # 10-level Animal Configuration at 44.1kHz
    # L1: 11k-22k, L2: 5.5k-11k, L3: 2.7k-5.5k, L4: 1.3k-2.7k, L5: 689-1.3k
    # L6: 344-689, L7: 172-344, L8: 86-172, L9: 43-86, L10: 21.5-43, A10: 0-21.5
    ANIMAL_LEVEL_MAP = {
        "large_mammals": [8, 9, 10, 0],   # 0 - 172 Hz
        "canines": [6, 7],                # 172 - 689 Hz
        "felines": [4, 5],                # 689 - 2.7k Hz
        "songbirds": [2, 3],              # 2.7k - 11k Hz
        "insects": [1]                    # 11k - 22k Hz
    }

    def __init__(self, sample_rate=44100):
        """
        Initialize animal mode separator
        """
        self.sample_rate = sample_rate
        self.num_bands = 5
        
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

            bands_list = ['songbirds', 'canines', 'felines', 'large_mammals', 'insects']
            for i, band_name in enumerate(bands_list):
                band_info = self.ANIMAL_RANGES[band_name]
                mask = (abs_freqs >= band_info['low']) & (abs_freqs < band_info['high'])
                fft_data[mask] *= processed_gains[i]

            equalized_signal = np.real(np.fft.ifft(fft_data))
        else:
            wavelet_name = wavelet if wavelet in pywt.wavelist(kind='discrete') else "db4"
            actual_level = 10 if not sliders_wavelet else max(1, min(int(wavelet_level or 6), 10))
            input_coeffs, output_coeffs, equalized_signal = self._apply_wavelet_equalization(
                signal_data, animal_names, gains, wavelet_name, actual_level, sliders_wavelet
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

    def _compute_level_gains(self, animal_names: List[str], gains: List[float], level: int) -> List[float]:
        level_gains = [1.0] * (level + 1)
        for name, gain in zip(animal_names, gains):
            name_low = str(name or "").lower().replace(" ", "_")
            mapped = self.ANIMAL_LEVEL_MAP.get(name_low, [])
            g = float(gain)
            for lv in mapped:
                if 0 <= lv <= level:
                    level_gains[lv] *= g
        return level_gains

    def _apply_wavelet_equalization(
        self,
        signal: np.ndarray,
        animal_names: List[str],
        gains: List[float],
        wavelet: str,
        level: int,
        sliders_wavelet: Optional[List[float]] = None
    ) -> Tuple[List[List[float]], List[List[float]], np.ndarray]:
        coeffs = pywt.wavedec(signal, wavelet, level=level)
        
        input_detail_coeffs = []
        input_detail_coeffs.append(coeffs[0].tolist())
        for lv in range(1, level + 1):
            idx = self._detail_index_for_level(level, lv)
            input_detail_coeffs.append(coeffs[idx].tolist())

        level_gains = self._compute_level_gains(animal_names, gains, level)

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

animals_service = AnimalModeSeparator(sample_rate=44100)