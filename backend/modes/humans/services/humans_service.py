"""
Humans Mode Service
Handles human voice separation and equalization
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple


class HumansModeService:
    """Service for humans mode signal processing"""

    # Voice characteristic frequency ranges
    # Non-overlapping ranges for clear separation in output
    VOICE_RANGES = {
        # Primary voice types - non-overlapping frequency bands
        "Adult Male": [[450, 1400]],          # 450-1400 Hz (85Hz fundamental, deep adult male)
        "Adult Female": [[1500, 4000]],       # 1500-4000 Hz
        "Child": [[900, 1500]],               # 900-1500 Hz
        "Elderly": [[350, 700]],              # 350-700 Hz (70Hz fundamental, lowest due to vocal cord aging)

        # Legacy mappings for backward compatibility
        "Male": [[450, 1400]],
        "Female": [[1500, 4000]],
        "Young": [[900, 1500]],
        "Old": [[50, 350]],

        # Language-specific characteristics
        "Arabic": [[50, 4000]],
        "English": [[50, 4000]],
        "Spanish": [[50, 4000]],
        "French": [[50, 4000]],
        "German": [[50, 4000]],
        "Chinese": [[50, 4000]],

        # Mixed descriptors
        "Adult": [[50, 4000]],
    }
    
    def __init__(self):
        self.default_sample_rate = 44100
    
    def process_signal(
        self,
        signal: np.ndarray,
        gains: List[float],
        voice_names: List[str],
        sample_rate: float = None,
        custom_freq_ranges: List[Tuple[float, float]] = None
    ) -> dict:
        """
        Process signal with human voice-based equalization

        Args:
            signal: Input signal array
            gains: Gain values for each voice (0-2)
            voice_names: Descriptions/names of voices
            sample_rate: Sample rate of signal
            custom_freq_ranges: Optional custom frequency ranges (overrides voice_names defaults)

        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)

        # Use custom ranges if provided, otherwise build from voice names
        if custom_freq_ranges and len(custom_freq_ranges) > 0:
            # Ensure we have multi-range format
            freq_ranges = []
            for freq_range in custom_freq_ranges:
                if isinstance(freq_range, (list, tuple)) and len(freq_range) == 2:
                    freq_ranges.append([tuple(freq_range)])
                else:
                    freq_ranges.append([freq_range])
        else:
            # Build frequency ranges from voice names
            freq_ranges = self._get_frequency_ranges(voice_names)

        # Compute input analysis for accurate A/B visualization.
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)

        # Apply equalization
        equalized_signal = self._apply_voice_equalization(signal, freq_ranges, gains, sr)
        
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
            "processing_time": processing_time
        }
    
    def _get_frequency_ranges(self, voice_names: List[str]) -> List[List[Tuple[float, float]]]:
        """Get frequency ranges for voice types - supports multi-range per voice"""
        ranges = []
        for name in voice_names:
            if name in self.VOICE_RANGES:
                sub_ranges = self.VOICE_RANGES[name]
                # Convert list format to tuples if needed
                voice_ranges = [tuple(r) if isinstance(r, list) else r for r in sub_ranges]
                ranges.append(voice_ranges)
            else:
                # Default fallback range
                ranges.append([(80, 8000)])
        return ranges
    
    def _apply_voice_equalization(
        self,
        signal: np.ndarray,
        freq_ranges: List[List[Tuple[float, float]]],
        gains: List[float],
        sample_rate: float
    ) -> np.ndarray:
        """Apply equalization with smooth transitions (Butterworth-like approach)"""
        if len(signal) == 0:
            return signal

        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        abs_freqs = np.abs(freqs)

        # Create a gain curve that varies smoothly across frequency
        gain_curve = np.ones(len(abs_freqs))

        # For each voice frequency band
        for voice_idx, (voice_ranges, gain) in enumerate(zip(freq_ranges, gains)):
            safe_gain = float(np.clip(gain, 0, 2))

            for low_hz, high_hz in voice_ranges:
                low_hz = float(low_hz)
                high_hz = float(high_hz)

                # Create smooth transition window using raised cosine
                bandwidth = high_hz - low_hz
                transition_width = bandwidth * 0.15  # 15% transition zone

                # Smooth rise at low end
                low_start = max(0, low_hz - transition_width)
                low_end = low_hz

                # Smooth fall at high end
                high_start = high_hz
                high_end = high_hz + transition_width

                for i, f in enumerate(abs_freqs):
                    if f < low_start:
                        continue
                    elif f < low_end:
                        # Smooth rise: raised cosine from 0 to 1
                        t = (f - low_start) / max(1e-6, low_end - low_start)
                        t = np.clip(t, 0, 1)
                        window = 0.5 * (1 - np.cos(np.pi * t))
                        gain_curve[i] *= (1 + (safe_gain - 1) * window)
                    elif f <= high_start:
                        # Passband: full gain
                        gain_curve[i] *= safe_gain
                    elif f < high_end:
                        # Smooth fall: raised cosine from 1 to 0
                        t = (f - high_start) / max(1e-6, high_end - high_start)
                        t = np.clip(t, 0, 1)
                        window = 0.5 * (1 + np.cos(np.pi * t))
                        gain_curve[i] *= (1 + (safe_gain - 1) * window)

        # Apply the smooth gain curve
        fft_data = fft_data * gain_curve
        equalized = np.real(np.fft.ifft(fft_data))
        return equalized
    
    def _compute_fft_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """Compute FFT for output signal"""
        fft_vals = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        magnitudes = np.abs(fft_vals)

        positive_idx = freqs > 0
        pos_freqs = freqs[positive_idx]
        pos_mags = magnitudes[positive_idx]

        # Reduce output resolution - subsample the FFT for faster transmission
        step = max(1, len(pos_freqs) // 500)  # Reduced from 1000 to 500

        return {
            "frequencies": pos_freqs[::step].tolist(),
            "magnitudes": pos_mags[::step].tolist()
        }
    
    def _compute_spectrogram_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """Compute spectrogram for output signal"""
        from scipy.signal import spectrogram

        # Reduce window size for faster computation
        nperseg = 512  # Reduced from 1024 for faster computation
        noverlap = 384  # Reduced from 768

        f, t, Sxx = spectrogram(
            signal,
            sample_rate,
            window='hann',
            nperseg=nperseg,
            noverlap=noverlap,
            scaling='spectrum',
            mode='psd'
        )

        ref = max(float(np.max(Sxx)), 1e-12)
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12) / ref)
        Sxx_db = np.maximum(Sxx_db, -80.0)

        # Downsample output for transmission (reduce data sent to frontend)
        freq_step = max(1, len(f) // 50)  # Reduced from 100 to 50
        time_step = max(1, len(t) // 50)  # Reduced from 100 to 50
        f_ds = f[::freq_step]
        t_ds = t[::time_step]
        Sxx_ds = Sxx_db[::freq_step, ::time_step]

        return {
            "frequencies": f_ds.tolist(),
            "times": t_ds.tolist(),
            "magnitude": Sxx_ds.tolist()
        }


# Singleton instance
humans_service = HumansModeService()
