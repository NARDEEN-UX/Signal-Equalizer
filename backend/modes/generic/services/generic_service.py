"""
Generic Mode Service
Handles frequency band equalization with custom subdivisions
"""

import numpy as np
from scipy.fft import fft, fftfreq
import time
from typing import List, Tuple, Optional


class GenericModeService:
    """Service for generic mode signal processing"""
    
    def __init__(self):
        self.default_sample_rate = 44100
    
    def process_signal(
        self, 
        signal: np.ndarray, 
        bands: List[dict],
        gains: List[float],
        sample_rate: Optional[float] = None
    ) -> dict:
        """
        Process signal with custom frequency-band equalization
        
        Args:
            signal: Input signal array
            bands: List of band configurations with 'low', 'high' keys
            gains: Gain values for each band (0-2)
            sample_rate: Optional sample rate
            sample_rate: Optional sample rate
            
        Returns:
            Dictionary with processed signal and analysis
        """
        start_time = time.time()
        sr = float(sample_rate) if sample_rate and sample_rate > 0 else float(self.default_sample_rate)

        # Compute input analysis for accurate A/B visualization.
        input_fft = self._compute_fft_data(signal, sr)
        input_spectrogram = self._compute_spectrogram_data(signal, sr)
        
        # Generic mode is intentionally FFT-only.
        input_coeffs = None
        output_coeffs = None
        equalized_signal = self._apply_fft_equalization(signal, bands, gains, sr)
        
        # Compute output analysis
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
    
    def _apply_fft_equalization(
        self, 
        signal: np.ndarray, 
        bands: List[dict],
        gains: List[float],
        sample_rate: float
    ) -> np.ndarray:
        """Apply FFT-based equalization to signal"""
        # Compute FFT
        fft_data = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        
        # Apply gain to each frequency band
        for band, gain in zip(bands, gains):
            low, high = band['low'], band['high']
            mask = (np.abs(freqs) >= low) & (np.abs(freqs) < high)
            fft_data[mask] *= gain
        
        # Inverse FFT
        equalized = np.real(np.fft.ifft(fft_data))
        return equalized
    
    def _compute_fft_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """Compute FFT for output signal"""
        fft_vals = fft(signal)
        freqs = fftfreq(len(signal), 1.0 / sample_rate)
        magnitudes = np.abs(fft_vals)
        
        # Return only positive frequencies (sample every Nth point for performance)
        positive_idx = freqs > 0
        pos_freqs = freqs[positive_idx]
        pos_mags = magnitudes[positive_idx]

        # Downsample for response while preserving narrow peaks.
        max_points = 1000
        if len(pos_freqs) <= max_points:
            ds_freqs = pos_freqs
            ds_mags = pos_mags
        else:
            edges = np.linspace(0, len(pos_freqs), num=max_points + 1, dtype=int)
            keep_idx = []
            for i in range(max_points):
                start = edges[i]
                end = edges[i + 1]
                if end <= start:
                    continue
                local_peak = start + int(np.argmax(pos_mags[start:end]))
                keep_idx.append(local_peak)

            ds_freqs = pos_freqs[keep_idx]
            ds_mags = pos_mags[keep_idx]

        return {
            "frequencies": ds_freqs.tolist(),
            "magnitudes": ds_mags.tolist()
        }
    
    def _compute_spectrogram_data(self, signal: np.ndarray, sample_rate: float) -> dict:
        """Compute spectrogram for output signal"""
        from scipy.signal import spectrogram
        signal = np.asarray(signal, dtype=np.float32).reshape(-1)
        if signal.size == 0:
            return {"frequencies": [], "times": [], "magnitude": []}

        # Remove only global DC once; avoid per-window detrending flicker artifacts.
        signal = signal - float(np.mean(signal))
        f, t, Sxx = spectrogram(
            signal,
            sample_rate,
            window='hann',
            nperseg=1024,
            noverlap=768,
            detrend=False,
            scaling='spectrum',
            mode='psd'
        )

        # Absolute log-power scale keeps inter-request intensity comparisons meaningful.
        Sxx_db = 10 * np.log10(np.maximum(Sxx, 1e-12))
        Sxx_db = np.clip(Sxx_db, -120.0, 0.0)
        # Preserve low-frequency resolution so narrow bass bands (e.g., 80-180 Hz)
        # remain visible after downsampling.
        low_cut_hz = 1000.0
        max_freq_bins = 180

        low_idx = np.where(f <= low_cut_hz)[0]
        high_idx = np.where(f > low_cut_hz)[0]

        if len(f) <= max_freq_bins:
            freq_idx = np.arange(len(f), dtype=int)
        else:
            remaining_budget = max(0, max_freq_bins - len(low_idx))
            if remaining_budget > 0 and len(high_idx) > 0:
                high_step = max(1, int(np.ceil(len(high_idx) / remaining_budget)))
                high_keep = high_idx[::high_step]
                freq_idx = np.concatenate([low_idx, high_keep])
            else:
                # Fallback: evenly sample all bins if low section already exceeds budget.
                uniform_step = max(1, int(np.ceil(len(f) / max_freq_bins)))
                freq_idx = np.arange(0, len(f), uniform_step, dtype=int)

            if freq_idx[-1] != len(f) - 1:
                freq_idx = np.append(freq_idx, len(f) - 1)

        time_step = max(1, len(t) // 100)
        t_ds = t[::time_step]
        f_ds = f[freq_idx]

        # Keep frequency bins directly (no cross-bin averaging) to avoid smearing EQ cuts.
        Sxx_time = Sxx_db[:, ::time_step]
        Sxx_ds = Sxx_time[freq_idx, :].astype(np.float32, copy=False)
        
        return {
            "frequencies": f_ds.tolist(),
            "times": t_ds.tolist(),
            "magnitude": Sxx_ds.tolist()
        }
    
    def validate_band_config(self, bands: List[dict], max_freq: float = 20000) -> Tuple[bool, str]:
        """Validate band configuration"""
        # Empty bands is a valid passthrough configuration (no EQ applied).
        if bands is None:
            return False, "Bands payload is required"
        if len(bands) == 0:
            return True, "Valid (passthrough)"
        
        for i, band in enumerate(bands):
            if 'low' not in band or 'high' not in band:
                return False, f"Band {i} missing 'low' or 'high'"
            
            if band['low'] < 0:
                return False, f"Band {i} has negative frequency"
            
            if band['high'] > max_freq:
                return False, f"Band {i} exceeds max frequency {max_freq}"
            
            if band['low'] >= band['high']:
                return False, f"Band {i} low >= high"
        
        return True, "Valid"


# Singleton instance
generic_service = GenericModeService()
