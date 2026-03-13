# modes.py – Returns mode config (name, slider labels, freq_bands, wavelet, wavelet_levels).

def get_mode_info(mode):
    if mode == 'human':
        return {
            'name': 'Human Voices',
            'num_sliders': 4,
            'slider_labels': ['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4'],
            'freq_bands': [(80, 180), (180, 300), (300, 3000), (3000, 8000)],
            'wavelet': 'haar',
            'wavelet_levels': 5,
            'sample_rate': 44100
        }
    if mode == 'animal':
        return {
            'name': 'Animal Sounds',
            'num_sliders': 4,
            'slider_labels': ['Bird', 'Cat', 'Dog', 'Lion'],
            'freq_bands': [(20, 500), (500, 2000), (2000, 8000), (8000, 16000)],
            'wavelet': 'db4',
            'wavelet_levels': 6
        }
    if mode == 'music':
        return {
            'name': 'Musical Instruments',
            'num_sliders': 4,
            'slider_labels': ['Bass', 'Piano', 'Vocals', 'Violin'],
            'freq_bands': [(60, 250), (250, 2000), (2000, 4000), (4000, 12000)],
            'wavelet': 'db4',
            'wavelet_levels': 6
        }
    if mode == 'ecg':
        return {
            'name': 'ECG Abnormalities',
            'num_sliders': 4,
            'slider_labels': ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3'],
            'freq_bands': [(0.5, 5), (5, 15), (15, 30), (30, 45)],  # Hz typical for ECG
            'wavelet': 'db4',
            'wavelet_levels': 5
        }
    return {}