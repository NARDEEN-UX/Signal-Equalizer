from total import fft, apply_filter_to_fft, reconstruct_signal, STFT
from scipy.io import wavfile
import numpy as np

class BaseMode:
    def __init__(self):
        self.data = None
        self.fs = None
        self.freq_data = None
        self.original_freq_data = None
        self.modified_freq_data = None
        self.mag = None
        self.freqs = None
        self.reconstructed = None
        self.original_length = None
        self.fft_computed = False
        self.stft_computed = False



    def get_data(self, file):
        fs, data = wavfile.read(file)
        self.data = data
        self.fs = fs
        self.original_length = len(data)
        self.fft_computed = False 
        return self.data, self.fs

    def compute_fft(self):
        if self.data is None or self.fs is None:
            raise ValueError("Load data first using get_data() method.")
        
        if self.fft_computed:
            return self.freq_data, self.mag, self.freqs

        # Flatten multi-channel data before FFT
        data_to_process = self.data
        if self.data.ndim > 1:
            data_to_process = self.data.mean(axis=1)
        
        # Compute once only
        self.N = 2 ** int(np.floor(np.log2(len(data_to_process))))

        self.freq_data, self.mag, self.freqs = fft(data_to_process, self.fs)
        self.original_freq_data = self.freq_data.copy()
        self.modified_freq_data = None
        self.fft_computed = True  
        return self.freq_data, self.mag, self.freqs
    

    def compute_stft(self, window_size=2048, hop_size=512):
        
        if self.data is None or self.fs is None:
            raise ValueError("Load data first using get_data() method.")
        
        if self.stft_computed:
            return self.stft_matrix, self.stft_freqs, self.stft_times

        # Flatten multi-channel data before STFT
        data_to_process = self.data
        if self.data.ndim > 1:
            data_to_process = self.data.mean(axis=1)

        self.stft_matrix, self.stft_freqs, self.stft_times = STFT(
            data_to_process, 
            self.fs,
            window_size=window_size,
            hop_size=hop_size
        )
        self.stft_computed = True

        return self.stft_matrix, self.stft_freqs, self.stft_times

    
    def process_all_bands(self, bands: list):
        """
        Process all bands at once. This is the main processing function.
   """
        if self.freq_data is None:
            raise ValueError("Compute FFT before processing.")
        
        # Clear old reconstructed data so we force fresh reconstruction
        self.reconstructed = None
        
        # Start fresh from original
        self.modified_freq_data = self.original_freq_data.copy()
        
        # If no bands, just return original (already copied above)
        if not bands:
            return self.modified_freq_data
        
        for band in bands:
            low = float(band["start_freq"])
            high = float(band["end_freq"])
            factor = float(band["scaling_factor"])
            
            self.modified_freq_data = apply_filter_to_fft(
                self.modified_freq_data,
                low,
                high,
                factor,
                N=self.N,
                fs=self.fs
            )
        
        return self.modified_freq_data


    def reconstruct(self):
        if self.freq_data is None:
            raise ValueError("Process the signal before reconstruction.")
        self.reconstructed = reconstruct_signal(self.modified_freq_data)
        # Trim to original data length (remove zero-padding from chunking)
        self.reconstructed = self.reconstructed[:self.original_length]
        return self.reconstructed