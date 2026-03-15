import numpy as np
from numba import njit

# ------------------- 1. FFT -------------------
@njit
def FFT(x):
    x = x.astype(np.complex128).flatten()   #Converts input to 1D complex array
    N = x.shape[0]   # N must be a power of 2

    # Bit-reversal permutation
    j = 0
    for i in range(1, N):
        bit = N >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            temp = x[i]
            x[i] = x[j]
            x[j] = temp

    # Iterative Cooley-Tukey (butterfly)
    len_ = 2
    while len_ <= N:
        wlen = np.exp(-2j * np.pi / len_) #W= e^(-2πj /N) | if N=2 => W= e^(-πj) = -1 ....
        for i in range(0, N, len_):
            w = 1 + 0j  #complex
            for j in range(len_ // 2):
                u = x[i + j]                      # G[k] first input
                v = x[i + j + len_ // 2] * w      # H[k] second input × W
                x[i + j] = u + v                  #X[k]
                x[i + j + len_ // 2] = u - v      #X[k + N/2]  this is for fast computation
                w *= wlen
        len_ *= 2

    return x

# ------------------- 2. FFT على chunks -------------------
@njit
def _fft_chunks(data, fs, N):
    """
    Split the signal into fixed-size chunks (of length N), compute FFT for each,
    and return frequency-domain results.
    """
    # Calculate how many chunks we need
    num_chunks = (len(data) + N - 1) // N
    
    # Pre-allocate array to store the full complex FFT of each chunk
    # Shape: (num_chunks, N)
    all_X = np.zeros((num_chunks, N), dtype=np.complex128)

    # Process each chunk one by one
    for i in range(num_chunks):
        # How much valid data is left in this chunk? (last chunk may be shorter)
        seg_len = min(N, len(data) - i * N)
        
        # Create a zero-padded segment of exactly length N
        segment = np.zeros(N, dtype=np.float64)
        
        # Copy the actual data into the segment (zero-padding if needed)
        for j in range(seg_len):
            segment[j] = data[i * N + j]
        
        # convert to complex128 because FFT works with complex numbers
        all_X[i, :] = FFT(segment.astype(np.complex128))

    # Compute magnitude spectrum (absolute value of complex FFT)
    mag = np.abs(all_X)
    
    # Only keep positive frequencies (0 to Nyquist): first N//2 bins  + normalize
    
    magnitude_spectrum = mag[:, :N//2] / N
    
    # Create frequency axis: from 0 Hz up to (almost) fs/2
    freqs = np.zeros(N//2, dtype=np.float64)
    for k in range(N//2):
        freqs[k] = fs * k / N          # Frequency bin: k * (fs / N)

    return all_X, magnitude_spectrum, freqs


def fft(data, fs):

    if data.ndim > 1:
        data = data.mean(axis=1)       # Shape becomes (samples,)

    # Choose largest power of 2 ≤ signal length (required for this radix-2 FFT)
    N = 2 ** int(np.floor(np.log2(len(data))))
    
    return _fft_chunks(data, fs, N)

# ------------------- 3. Apply filter -------------------
@njit
def apply_filter_to_fft(all_X, low, high, factor, N, fs):
    all_X_mod = all_X.copy()
    num_chunks = all_X.shape[0]

    low_idx = max(0, round(low * N / fs))
    high_idx = min(N//2, round(high * N / fs))

    for c in range(num_chunks):
        X = all_X_mod[c]
        for k in range(low_idx, high_idx + 1):
            if k == 0 or (N % 2 == 0 and k == N // 2):
                X[k] *= factor
            else:
                X[k] *= factor
                X[N - k] *= factor
        all_X_mod[c] = X

    return all_X_mod




# ------------------- 4. IFFT -------------------
@njit
def IFFT(X):
    X_conj = np.conjugate(X)
    x = FFT(X_conj)
    return np.conjugate(x) / len(X)

# ------------------- 5. Reconstruct signal -------------------
@njit
def reconstruct_signal(all_X_mod):
    num_chunks, N = all_X_mod.shape
    x_reconstructed = np.zeros(num_chunks * N, dtype=np.float64)

    for c in range(num_chunks):
        chunk_time = np.real(IFFT(all_X_mod[c]))
        for j in range(N):
            x_reconstructed[c * N + j] = chunk_time[j]

    return x_reconstructed

# ------------------- 6. STFT -------------------
@njit
def _stft_internal(data, fs, window_size, hop_size):
    """Internal njit function that expects flattened 1D data"""
    num_frames = 1 + (len(data) - window_size) // hop_size
    stft_matrix = np.zeros((num_frames, window_size//2), dtype=np.float64)
    times = np.zeros(num_frames, dtype=np.float64)

    # Precompute Hamming window
    window = np.zeros(window_size, dtype=np.float64)
    for i in range(window_size):
        window[i] = 0.54 - 0.46 * np.cos(2 * np.pi * i / (window_size - 1))

    for i in range(num_frames):
        times[i] = i * hop_size / fs
        segment = np.zeros(window_size, dtype=np.float64)
        for j in range(window_size):
            idx = i * hop_size + j
            if idx < len(data):
                segment[j] = data[idx] * window[j]
            else:
                segment[j] = 0.0
        spectrum = FFT(segment.astype(np.complex128))
        for k in range(window_size//2):
            stft_matrix[i, k] = np.abs(spectrum[k]) / window_size

    freqs = np.zeros(window_size//2, dtype=np.float64)
    for k in range(window_size//2):
        freqs[k] = fs * k / window_size

    return stft_matrix, freqs, times

def STFT(data, fs, window_size=1024, hop_size=512):
    """Wrapper that handles multi-channel audio before calling njit function"""
    # Flatten multi-channel data
    if data.ndim > 1:
        data = data.mean(axis=1)
    
    return _stft_internal(data, fs, window_size, hop_size)