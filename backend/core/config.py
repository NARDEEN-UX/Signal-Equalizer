# Core configuration for modes
MODE_CONFIGS = {
    'human': {
        'name': 'Human Voices',
        'num_sliders': 4,
        'slider_labels': ['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4'],
        'freq_bands': [(80, 180), (180, 300), (300, 3000), (3000, 8000)],
        'wavelet': 'haar',
        'wavelet_levels': 5,
        'sample_rate': 44100,
        'requirements': ['Male voice', 'Female voice', 'Young speaker', 'Old speaker']
    },
    'animal': {
        'name': 'Animal Sounds',
        'num_sliders': 4,
        'slider_labels': ['Birds', 'Dogs', 'Cats', 'Others'],
        'freq_bands': [(20, 500), (500, 2000), (2000, 8000), (8000, 16000)],
        'wavelet': 'db4',
        'wavelet_levels': 6,
        'requirements': ['Bird sounds', 'Dog barks', 'Cat meows', 'Other animal sounds']
    },
    'music': {
        'name': 'Musical Instruments',
        'num_sliders': 4,
        'slider_labels': ['Bass', 'Piano', 'Vocals', 'Violin'],
        'freq_bands': [(60, 250), (250, 2000), (2000, 4000), (4000, 12000)],
        'wavelet': 'db4',
        'wavelet_levels': 6,
        'requirements': ['Bass instrument', 'Piano', 'Vocal tracks', 'Violin']
    },
    'ecg': {
        'name': 'ECG Abnormalities',
        'num_sliders': 4,
        'slider_labels': ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3'],
        'freq_bands': [(0.5, 5), (5, 15), (15, 30), (30, 45)],
        'wavelet': 'db4',
        'wavelet_levels': 5,
        'requirements': ['Normal ECG', 'Atrial fibrillation', 'Ventricular tachycardia', 'Heart block']
    },
    'generic': {
        'name': 'Generic Mode',
        'num_sliders': 4,
        'slider_labels': ['Band 1', 'Band 2', 'Band 3', 'Band 4'],
        'wavelet': 'db4',
        'wavelet_levels': 5,
        'sample_rate': 44100
    }
}

def get_mode_config(mode_id):
    return MODE_CONFIGS.get(mode_id, {})
