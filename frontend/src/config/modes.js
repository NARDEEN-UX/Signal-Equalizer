/**
 * Centralized mode configuration
 * Each mode is defined here with its UI properties
 * Backend endpoints will be added in respective service files
 */

export const MODES = [
  {
    id: 'human',
    name: 'Human Voices',
    tag: '4-speaker mix',
    description: 'Manage multiple human voices in a single recording.',
    accentClass: 'mode-human',
    icon: '👤',
    sliderLabels: ['Male Voice', 'Female Voice', 'Young Speaker', 'Old Speaker'],
    freqBands: [(80, 180), (180, 300), (300, 3000), (3000, 8000)],
    wavelet: 'haar',
    waveletLevels: 5,
    sampleRate: 44100,
    allowAddSubdivision: false,
    requirements: ['Male voice', 'Female voice', 'Young speaker', 'Old speaker']
  },
  {
    id: 'animal',
    name: 'Animal Sounds',
    tag: 'Animal mixture',
    description: 'Adjust different animal sounds with scientifically accurate frequency ranges.',
    accentClass: 'mode-animal',
    icon: '❖',
    sliderLabels: ['Songbirds', 'Canines', 'Felines', 'Large Mammals', 'Insects'],
    freqBands: [(1000, 8000), (150, 2000), (48, 10000), (5, 500), (600, 20000)],
    wavelet: 'db4',
    waveletLevels: 6,
    allowAddSubdivision: false,
    requirements: ['Songbird sounds (1,000-8,000 Hz)', 'Dog/Wolf barks (150-2,000 Hz)', 'Cat meows/hisses (48-10,000 Hz)', 'Elephant/Whale calls (5-500 Hz)', 'Cricket/Bee sounds (600-20,000 Hz)']
  },
  {
    id: 'music',
    name: 'Musical Instruments',
    tag: 'Music.wav',
    description: 'Control Demucs stems inside a musical mix.',
    accentClass: 'mode-music',
    icon: '♫',
    sliderLabels: ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other'],
    freqBands: [(20, 12000), (20, 300), (80, 8000), (80, 5000), (27, 5000), (20, 20000)],
    wavelet: 'db4',
    waveletLevels: 6,
    allowAddSubdivision: false,
    requirements: ['Demucs drums stem', 'Demucs bass stem', 'Demucs vocals stem', 'Demucs guitar stem', 'Demucs piano stem', 'Demucs other stem']
  },
  {
    id: 'ecg',
    name: 'ECG Abnormalities',
    tag: 'Heart signals',
    description: 'Analyze and isolate different ECG abnormalities.',
    accentClass: 'mode-ecg',
    icon: '❤️',
    sliderLabels: ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3'],
    freqBands: [(0.5, 5), (5, 15), (15, 30), (30, 45)],
    wavelet: 'db4',
    waveletLevels: 5,
    allowAddSubdivision: false,
    requirements: ['Normal ECG', 'Atrial fibrillation', 'Ventricular tachycardia', 'Heart block']
  },
  {
    id: 'generic',
    name: 'Generic Mode',
    tag: 'Flexible frequency bands',
    description: 'Customize frequency subdivisions with precise equalizer controls.',
    accentClass: 'mode-generic',
    icon: '⟟',
    sliderLabels: ['Band 1', 'Band 2', 'Band 3', 'Band 4'],
    allowAddSubdivision: true
  }
];

export const getModeConfig = (modeId) => {
  return MODES.find(mode => mode.id === modeId) || null;
};

export const getModeById = (modeId) => {
  return MODES.find(mode => mode.id === modeId);
};
