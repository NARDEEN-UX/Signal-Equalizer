"""
Digital Signal Processing utilities
"""
import numpy as np
from scipy import signal
import soundfile as sf

def compute_fft(signal_data, sr=44100):
    """Compute FFT of signal"""
    fft_vals = np.fft.fft(signal_data)
    freqs = np.fft.fftfreq(len(signal_data), 1/sr)
    return freqs[:len(freqs)//2], np.abs(fft_vals[:len(fft_vals)//2])

def compute_spectrogram(signal_data, sr=44100):
    """Compute spectrogram"""
    f, t, Sxx = signal.spectrogram(signal_data, sr=sr, nperseg=512)
    return f, t, Sxx

def apply_freq_equalization(signal_data, freq_bands, scales, sr=44100):
    """
    Apply frequency equalization using provided bands and scales.
    
    Args:
        signal_data: Input signal
        freq_bands: List of (low_freq, high_freq) tuples
        scales: List of scale factors for each band
        sr: Sample rate
    
    Returns:
        Equalized signal
    """
    output = np.copy(signal_data)
    fft_vals = np.fft.fft(output)
    freqs = np.fft.fftfreq(len(output), 1/sr)
    
    for (low_f, high_f), scale in zip(freq_bands, scales):
        mask = (np.abs(freqs) >= low_f) & (np.abs(freqs) <= high_f)
        fft_vals[mask] *= scale
    
    return np.real(np.fft.ifft(fft_vals))

def compute_wavelet_decomp(signal_data, wavelet='db4', level=5):
    """Compute wavelet decomposition using multi-resolution analysis"""
    # Use SciPy's cascade for simplicity - applies cascaded Morlet wavelet
    coeffs = []
    current = signal_data.copy()
    
    for i in range(level):
        # Apply a simple high-pass and low-pass filter cascade
        b, a = signal.butter(2, 0.5)
        lowpass = signal.filtfilt(b, a, current)
        coeffs.append(lowpass)
        current = lowpass
    
    return coeffs

def apply_wavelet_equalization(signal_data, scales, wavelet='db4', level=5):
    """
    Apply wavelet-based equalization using scipy filters.
    
    Args:
        signal_data: Input signal
        scales: Scale factors for each decomposition level
        wavelet: Wavelet type (informational)
        level: Decomposition level
    
    Returns:
        Reconstructed signal
    """
    # Decompose
    coeffs = compute_wavelet_decomp(signal_data, wavelet, level)
    
    # Apply scaling to coefficients
    scaled_coeffs = []
    for i, coeff in enumerate(coeffs):
        if i < len(scales):
            scaled_coeffs.append(coeff * scales[i])
        else:
            scaled_coeffs.append(coeff)
    
    # Reconstruct by summing the decomposition levels
    output = np.sum(np.array(scaled_coeffs), axis=0)
    return output

def save_audio(audio_data, path, sr=44100):
    """Save audio file"""
    sf.write(path, audio_data, sr)

def load_audio(path):
    """Load audio file"""
    signal_data, sr = sf.read(path)
    if len(signal_data.shape) > 1:
        signal_data = np.mean(signal_data, axis=1)
    return signal_data, sr

def normalize_signal(signal_data):
    """Normalize signal to [-1, 1]"""
    max_val = np.max(np.abs(signal_data))
    if max_val > 0:
        return signal_data / max_val
    return signal_data
