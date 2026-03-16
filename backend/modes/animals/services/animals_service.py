"""
Animal Mode Service
Handles animal sound separation with 5 scientifically accurate frequency bands
Routes: /api/modes/animals/...

Bands:
  0: Songbirds (2,000 - 12,000 Hz)
  1: Canines (250 - 4,000 Hz)
  2: Felines (100 - 8,000 Hz)
  3: Large Mammals (20 - 2,000 Hz)
  4: Insects (1,000 - 20,000 Hz)
"""

import numpy as np
from scipy import signal
import json


class AnimalModeSeparator:
    """
    Separate animal sounds using frequency-based decomposition
    Supports 5 animal categories with scientifically accurate frequency ranges
    """
    
    # 5-Band Animal Configuration
    ANIMAL_BANDS = {
        'songbirds': {
            'id': 'animal-0',
            'name': 'Songbirds',
            'low': 2000,
            'high': 12000,
            'examples': 'Sparrow, Canary, Warbler, Finch'
        },
        'canines': {
            'id': 'animal-1',
            'name': 'Canines',
            'low': 250,
            'high': 4000,
            'examples': 'Dog, Wolf, Hyena, Fox'
        },
        'felines': {
            'id': 'animal-2',
            'name': 'Felines',
            'low': 100,
            'high': 8000,
            'examples': 'Cat, Lion, Tiger, Leopard'
        },
        'large_mammals': {
            'id': 'animal-3',
            'name': 'Large Mammals',
            'low': 20,
            'high': 2000,
            'examples': 'Elephant, Whale, Horse, Cattle'
        },
        'insects': {
            'id': 'animal-4',
            'name': 'Insects',
            'low': 1000,
            'high': 20000,
            'examples': 'Cricket, Cicada, Bee, Grasshopper'
        }
    }
    
    def __init__(self, sample_rate=44100):
        """
        Initialize animal mode separator
        
        Args:
            sample_rate: Sample rate in Hz (default 44100)
        """
        self.sample_rate = sample_rate
        self.num_bands = 5
        
    def _get_frequency_ranges_from_bands(self, band_names):
        """
        Get frequency ranges for specified bands
        
        Args:
            band_names: List of band names or IDs
            
        Returns:
            List of (low, high) frequency tuples
        """
        ranges = []
        for band in band_names:
            if band in self.ANIMAL_BANDS:
                band_info = self.ANIMAL_BANDS[band]
            else:
                # Try to find by ID
                band_info = None
                for b_info in self.ANIMAL_BANDS.values():
                    if b_info['id'] == band:
                        band_info = b_info
                        break
            
            if band_info:
                ranges.append((band_info['low'], band_info['high']))
            else:
                ranges.append((0, self.sample_rate / 2))
        
        return ranges
    
    def create_bandpass_filter(self, low_freq, high_freq, order=5):
        """
        Create a butterworth bandpass filter
        
        Args:
            low_freq: Lower cutoff frequency
            high_freq: Upper cutoff frequency
            order: Filter order
            
        Returns:
            Tuple of (b, a) coefficients
        """
        nyquist = self.sample_rate / 2
        
        # Normalize frequencies
        low = low_freq / nyquist
        high = high_freq / nyquist
        
        # Ensure valid range
        low = max(0.001, min(0.999, low))
        high = max(0.001, min(0.999, high))
        
        # Ensure low < high
        if low >= high:
            low = max(0.001, high - 0.01)
        
        try:
            b, a = signal.butter(order, [low, high], btype='band')
            return b, a
        except Exception as e:
            print(f"Error creating filter: {e}")
            return None, None
    
    def apply_bandpass_filter(self, data, low_freq, high_freq, order=5):
        """
        Apply bandpass filter to signal
        
        Args:
            data: Input signal
            low_freq: Lower cutoff frequency
            high_freq: Upper cutoff frequency
            order: Filter order
            
        Returns:
            Filtered signal
        """
        b, a = self.create_bandpass_filter(low_freq, high_freq, order)
        
        if b is None or a is None:
            return data
        
        try:
            return signal.filtfilt(b, a, data)
        except Exception as e:
            print(f"Error applying filter: {e}")
            return data
    
    def separate_animals(self, audio_data, gains=None):
        """
        Separate audio into 5 animal categories
        
        Args:
            audio_data: Input audio signal (numpy array)
            gains: List of 5 gain values [0-2] for each band
                  Default: [1.0, 1.0, 1.0, 1.0, 1.0]
            
        Returns:
            Dictionary with separated animal signals:
            {
                'songbirds': separated signal,
                'canines': separated signal,
                'felines': separated signal,
                'large_mammals': separated signal,
                'insects': separated signal,
                'output': combined with gains applied,
                'metadata': processing info
            }
        """
        if gains is None:
            gains = [1.0, 1.0, 1.0, 1.0, 1.0]
        
        # Ensure we have 5 gains
        while len(gains) < 5:
            gains.append(1.0)
        gains = gains[:5]
        
        separated = {}
        bands_list = ['songbirds', 'canines', 'felines', 'large_mammals', 'insects']
        
        output_signal = np.zeros_like(audio_data)
        
        for i, band_name in enumerate(bands_list):
            band_info = self.ANIMAL_BANDS[band_name]
            low_freq = band_info['low']
            high_freq = band_info['high']
            gain = gains[i]
            
            # Apply bandpass filter
            filtered = self.apply_bandpass_filter(
                audio_data,
                low_freq,
                high_freq,
                order=5
            )
            
            # Apply gain
            filtered = filtered * gain
            
            # Store separated signal
            separated[band_name] = {
                'signal': filtered,
                'band': band_info['name'],
                'freq_range': f"{low_freq}-{high_freq} Hz",
                'gain': gain
            }
            
            # Add to output
            output_signal += filtered
        
        # Normalize output to prevent clipping
        max_val = np.max(np.abs(output_signal))
        if max_val > 0:
            output_signal = output_signal / max_val * 0.95
        
        return {
            'separated': separated,
            'output': output_signal,
            'metadata': {
                'num_bands': 5,
                'sample_rate': self.sample_rate,
                'bands': bands_list,
                'gains': gains
            }
        }
    
    def get_band_info(self):
        """
        Get information about all animal bands
        
        Returns:
            List of band information dictionaries
        """
        bands_info = []
        for band_name, band_info in self.ANIMAL_BANDS.items():
            bands_info.append({
                'id': band_info['id'],
                'name': band_info['name'],
                'low': band_info['low'],
                'high': band_info['high'],
                'examples': band_info['examples'],
                'key': band_name
            })
        return bands_info
    
    def get_frequency_stats(self, audio_data):
        """
        Get frequency statistics for the input signal
        
        Args:
            audio_data: Input audio signal
            
        Returns:
            Dictionary with frequency analysis
        """
        # Compute FFT
        fft_result = np.fft.rfft(audio_data)
        freqs = np.fft.rfftfreq(len(audio_data), 1/self.sample_rate)
        magnitude = np.abs(fft_result)
        
        # Find peak frequency
        peak_idx = np.argmax(magnitude)
        peak_freq = freqs[peak_idx]
        
        # Band energy
        bands_list = ['songbirds', 'canines', 'felines', 'large_mammals', 'insects']
        band_energies = {}
        
        for band_name in bands_list:
            band_info = self.ANIMAL_BANDS[band_name]
            low = band_info['low']
            high = band_info['high']
            
            mask = (freqs >= low) & (freqs <= high)
            energy = np.sum(magnitude[mask] ** 2)
            band_energies[band_name] = float(energy)
        
        return {
            'peak_frequency': float(peak_freq),
            'band_energies': band_energies,
            'total_energy': float(np.sum(magnitude ** 2))
        }


# ============================================================================
# Flask Route Handlers
# ============================================================================

def create_animal_routes(app):
    """
    Create Flask routes for animal mode
    
    Args:
        app: Flask application instance
    """
    
    separator = AnimalModeSeparator(sample_rate=44100)
    
    @app.route('/api/modes/animals/info', methods=['GET'])
    def get_animal_info():
        """Get animal band information"""
        try:
            bands_info = separator.get_band_info()
            return {
                'status': 'success',
                'mode': 'animals',
                'num_bands': 5,
                'bands': bands_info,
                'description': 'Animal sounds with 5 scientifically accurate frequency bands'
            }, 200
        except Exception as e:
            return {'status': 'error', 'message': str(e)}, 500
    
    @app.route('/api/modes/animals/separate', methods=['POST'])
    def separate_animals():
        """
        Separate animal sounds in audio
        
        Request body:
        {
            'audio': base64 encoded audio or numpy array,
            'gains': [gain0, gain1, gain2, gain3, gain4]
        }
        """
        try:
            data = request.get_json()
            
            # Get audio data (implement based on your audio handling)
            # This is a placeholder
            if 'audio' not in data:
                return {'status': 'error', 'message': 'No audio provided'}, 400
            
            # Get gains (default to 1.0 for each band)
            gains = data.get('gains', [1.0, 1.0, 1.0, 1.0, 1.0])
            
            # Separate animals
            result = separator.separate_animals(audio_data, gains)
            
            return {
                'status': 'success',
                'separated': {k: v['signal'].tolist() for k, v in result['separated'].items()},
                'output': result['output'].tolist(),
                'metadata': result['metadata']
            }, 200
        except Exception as e:
            return {'status': 'error', 'message': str(e)}, 500
    
    @app.route('/api/modes/animals/stats', methods=['POST'])
    def get_animal_stats():
        """Get frequency statistics for audio"""
        try:
            data = request.get_json()
            
            if 'audio' not in data:
                return {'status': 'error', 'message': 'No audio provided'}, 400
            
            # Get frequency statistics
            stats = separator.get_frequency_stats(audio_data)
            
            return {
                'status': 'success',
                'stats': stats
            }, 200
        except Exception as e:
            return {'status': 'error', 'message': str(e)}, 500


if __name__ == '__main__':
    # Example usage
    separator = AnimalModeSeparator(sample_rate=44100)
    
    # Get band info
    print("Animal Bands Information:")
    print(json.dumps(separator.get_band_info(), indent=2))
    
    # Example: separate with custom gains
    # test_audio = np.random.randn(44100)
    # result = separator.separate_animals(test_audio, gains=[1.5, 1.0, 0.8, 1.2, 0.9])
    # print("Separation complete")