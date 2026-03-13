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
    sliderLabels: ['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4'],
    freqBands: [(80, 180), (180, 300), (300, 3000), (3000, 8000)],
    wavelet: 'haar',
    waveletLevels: 5,
    sampleRate: 44100
  },
  {
    id: 'animal',
    name: 'Animal Sounds',
    tag: 'Animal mixture',
    description: 'Adjust different animal sounds in a complex mixture.',
    accentClass: 'mode-animal',
    icon: '❖',
    sliderLabels: ['Birds', 'Dogs', 'Cats', 'Others'],
    freqBands: [(20, 500), (500, 2000), (2000, 8000), (8000, 16000)],
    wavelet: 'db4',
    waveletLevels: 6
  },
  {
    id: 'music',
    name: 'Musical Instruments',
    tag: 'Music.wav',
    description: 'Control individual instruments inside a musical mix.',
    accentClass: 'mode-music',
    icon: '♫',
    sliderLabels: ['Bass', 'Piano', 'Vocals', 'Violin'],
    freqBands: [(60, 250), (250, 2000), (2000, 4000), (4000, 12000)],
    wavelet: 'db4',
    waveletLevels: 6
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
    waveletLevels: 5
  },
  {
    id: 'generic',
    name: 'Generic Mode',
    tag: 'Flexible frequency bands',
    description: 'Customize frequency subdivisions with precise equalizer controls.',
    accentClass: 'mode-generic',
    icon: '⟟',
    sliderLabels: ['Band 1', 'Band 2', 'Band 3', 'Band 4']
  }
];

export const getModeConfig = (modeId) => {
  return MODES.find(mode => mode.id === modeId) || null;
};

export const getModeById = (modeId) => {
  return MODES.find(mode => mode.id === modeId);
};
