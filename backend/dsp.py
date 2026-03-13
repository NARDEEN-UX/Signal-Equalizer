# dsp.py – FFT, spectrogram, frequency equalization, wavelet decomposition and wavelet equalization.
import numpy as np
from scipy.fft import rfft, rfftfreq, irfft
from scipy.signal import spectrogram
import pywt

def compute_fft(signal, fs):
    n = len(signal)
    fft_vals = rfft(signal)
    fft_freq = rfftfreq(n, 1/fs)
    fft_mag = np.abs(fft_vals)
    return fft_freq, fft_mag

def compute_spectrogram(signal, fs):
    f, t, Sxx = spectrogram(signal, fs)
    return t, f, Sxx

def apply_freq_equalization(signal, fs, gains, bands):
    """Apply gain to each frequency band using FFT masking."""
    n = len(signal)
    fft_vals = rfft(signal)
    freqs = rfftfreq(n, 1/fs)
    mask = np.ones_like(fft_vals)
    for (low, high), gain in zip(bands, gains):
        idx = np.where((freqs >= low) & (freqs <= high))
        mask[idx] = gain
    new_fft = fft_vals * mask
    return irfft(new_fft, n=n)

def compute_wavelet_decomp(signal, wavelet, level):
    return pywt.wavedec(signal, wavelet, level=level)

def apply_wavelet_equalization(signal, gains, wavelet, level):
    """
    For Human mode, we map each voice to a different detail level.
    Level 1 (finest) → Voice 1, Level 2 → Voice 2, etc.
    Approximation coefficients remain unchanged.
    """
    coeffs = pywt.wavedec(signal, wavelet, level=level)
    new_coeffs = [coeffs[0]]  # approximation untouched
    for i, gain in enumerate(gains):
        if i+1 < len(coeffs):
            new_coeffs.append(coeffs[i+1] * gain)
        else:
            break
    # If more gains than levels, extra gains ignored
    return pywt.waverec(new_coeffs, wavelet)