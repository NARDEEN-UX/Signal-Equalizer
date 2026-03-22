import React, { useState, useEffect, useMemo, useRef } from 'react';
import WaveformViewer from './components/WaveformViewer';
import EqualizerCurve from './components/EqualizerCurve';
import FFTChart from './components/FFTChart';
import WaveletChart from './components/WaveletChart';
import SpectrogramViewer from './components/SpectrogramViewer';
import TransportControls from './components/TransportControls';
import AudiogramToggle from './components/AudiogramToggle';
import ModeModal from './components/ModeModal';
import ModeSignalUploader from './components/ModeSignalUploader';
import GenericBandBuilder from './components/GenericBandBuilder';
import BandPresetModal from './components/BandPresetModal';
import SliderGroup from './components/SliderGroup';
import ECGAIViewer from './components/ECGAIViewer';
import './App.css';
import { useBackendProcessing } from './hooks/useBackendProcessing';
import { useMockProcessing } from './mock/useMockProcessing';
import {
  API_BASE_URL,
  saveSchema,
  loadSchema,
  getGenericDefault,
  getMusicDefault,
  getAnimalsDefault,
  getHumansDefault,
  getECGDefault,
  uploadAudio,
  processGenericMode,
  processMusicMode,
  separateMusicModeDemucs,
  processAnimalsMode,
  processHumansMode,
  processECGMode
} from './api';

const MODES = [
  {
    id: 'generic',
    name: 'Generic Mode',
    tag: 'Flexible frequency bands',
    description: 'Customize frequency subdivisions with precise equalizer controls.',
    accentClass: 'mode-generic',
    icon: '⟟',
    sliderLabels: ['Band 1', 'Band 2', 'Band 3', 'Band 4'],
    allowAddSubdivision: true
  },
  {
    id: 'music',
    name: 'Musical Instruments',
    tag: 'Music.wav',
    description: 'Control Demucs sources inside a musical mix.',
    accentClass: 'mode-music',
    icon: '♫',
    sliderLabels: ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other'],
    allowAddSubdivision: false,
    requirements: ['Demucs drums stem', 'Demucs bass stem', 'Demucs vocals stem', 'Demucs guitar stem', 'Demucs piano stem', 'Demucs other stem']
  },
  {
    id: 'animal',
    name: 'Animal Sounds',
    tag: 'Animal mixture',
    description: 'Adjust different animal sounds with scientifically accurate frequency ranges.',
    accentClass: 'mode-animal',
    icon: '❖',
    sliderLabels: ['Songbirds', 'Canines', 'Felines', 'Large Mammals', 'Insects'],
    allowAddSubdivision: false,
    requirements: ['Songbird sounds (2,000-12,000 Hz)', 'Dog/Wolf barks (250-4,000 Hz)', 'Cat meows/hisses (100-8,000 Hz)', 'Elephant/Whale calls (20-2,000 Hz)', 'Cricket/Bee sounds (1,000-20,000 Hz)']
  },
  {
    id: 'human',
    name: 'Human Voices',
    tag: '4-speaker mix',
    description: 'Manage multiple human voices in a single recording.',
    accentClass: 'mode-human',
    icon: '⌁',
    sliderLabels: ['Male Voice', 'Female Voice', 'Young Speaker', 'Old Speaker'],
    allowAddSubdivision: false,
    requirements: ['Male voice', 'Female voice', 'Young speaker', 'Old speaker']
  },
  {
    id: 'ecg',
    name: 'ECG Abnormalities',
    tag: '4 ECG signals',
    description: 'Control magnitude of arrhythmia components (normal + 3 types).',
    accentClass: 'mode-ecg',
    icon: '♡',
    sliderLabels: ['Normal Sinus', 'Atrial Fibrillation', 'Ventricular Tachycardia', 'Heart Block'],
    allowAddSubdivision: false,
    requirements: ['Normal sinus rhythm (0.5–3 Hz)', 'Atrial fibrillation (5–50 Hz)', 'Ventricular tachycardia (3–5 Hz)', 'Heart block (0.05–0.5 Hz)']
  },
  {
    id: 'ai-music',
    name: 'AI Music Separation',
    tag: 'AI-powered',
    description: 'AI-powered separation of musical instruments.',
    accentClass: 'mode-ai',
    icon: '◇',
    sliderLabels: [],
    disabled: true
  }
];

const LANDING_MODES = [
  { id: 'generic', title: 'Generic Mode', desc: 'Custom frequency bands' },
  { id: 'music', title: 'Musical Instruments', desc: 'Isolate Demucs stems (drums, bass, vocals, guitar, piano, other)' },
  { id: 'animal', title: 'Animal Sounds', desc: 'Separate mixed animal tracks' },
  { id: 'human', title: 'Human Voices', desc: 'Distinguish overlapping speakers' },
  { id: 'ecg', title: 'ECG Abnormalities', desc: 'Detect cardiac arrhythmias' }
];

// Default band configurations for each mode
const DEFAULT_MODE_BANDS = {
  generic: [
    { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1 },
    { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1 },
    { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1 },
    { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1 }
  ],
  music: [
    { id: 'music-0', name: 'drums', low: 20, high: 12000, gain: 1.0 },
    { id: 'music-1', name: 'bass', low: 20, high: 300, gain: 1.0 },
    { id: 'music-2', name: 'vocals', low: 80, high: 8000, gain: 1.0 },
    { id: 'music-3', name: 'guitar', low: 80, high: 5000, gain: 1.0 },
    { id: 'music-4', name: 'piano', low: 27, high: 5000, gain: 1.0 },
    { id: 'music-5', name: 'other', low: 20, high: 20000, gain: 1.0 }
  ],
  animal: [
    { id: 'animal-0', name: 'Songbirds', low: 1000, high: 8000, gain: 1.0, examples: 'Sparrow, Canary, Warbler, Finch' },
    { id: 'animal-1', name: 'Canines', low: 150, high: 2000, gain: 1.0, examples: 'Dog, Wolf, Hyena, Fox' },
    { id: 'animal-2', name: 'Felines', low: 48, high: 10000, gain: 1.0, examples: 'Cat, Lion, Tiger, Leopard' },
    { id: 'animal-3', name: 'Large Mammals', low: 5, high: 500, gain: 1.0, examples: 'Elephant, Whale, Horse, Cattle' },
    { id: 'animal-4', name: 'Insects', low: 600, high: 20000, gain: 1.0, examples: 'Cricket, Cicada, Bee, Grasshopper' }
  ],
  human: [
    { id: 'human-0', name: 'Male Voice', low: 85, high: 180, gain: 1 },
    { id: 'human-1', name: 'Female Voice', low: 165, high: 255, gain: 1 },
    { id: 'human-2', name: 'Young Speaker', low: 250, high: 450, gain: 1 },
    { id: 'human-3', name: 'Old Speaker', low: 80, high: 150, gain: 1 }
  ],
  ecg: [
    { id: 'ecg-0', name: 'Normal Sinus', low: 0.5, high: 3, gain: 1 },
    { id: 'ecg-1', name: 'Atrial Fibrillation', low: 5, high: 50, gain: 1 },
    { id: 'ecg-2', name: 'Ventricular Tachycardia', low: 3, high: 5, gain: 1 },
    { id: 'ecg-3', name: 'Heart Block', low: 0.05, high: 0.5, gain: 1 }
  ]
};

const WAVELET_BASIS_OPTIONS = [
  { value: 'haar', label: 'Haar' },
  { value: 'db4', label: 'Daubechies 4 (db4)' },
  { value: 'db6', label: 'Daubechies 6 (db6)' },
  { value: 'db8', label: 'Daubechies 8 (db8)' },
  { value: 'sym5', label: 'Symlet 5 (sym5)' },
  { value: 'sym8', label: 'Symlet 8 (sym8)' },
  { value: 'coif3', label: 'Coiflet 3 (coif3)' },
  { value: 'bior3.5', label: 'Biorthogonal 3.5 (bior3.5)' },
  { value: 'dmey', label: 'Discrete Meyer (dmey)' }
];

const DEFAULT_WAVELET_LEVEL = 6;
const WAVELET_DEC_LEN = {
  haar: 2,
  db4: 8,
  db6: 12,
  db8: 16,
  sym5: 10,
  sym8: 16,
  coif3: 18,
  'bior3.5': 12,
  dmey: 62
};

const WAVELET_BASIS_MAP = WAVELET_BASIS_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

const MODE_DEFAULT_WAVELET = {
  generic: 'db4',
  music: 'db8',
  animal: 'sym8',
  animals: 'sym8',
  human: 'sym5',
  humans: 'sym5',
  ecg: 'bior3.5'
};

const WAVELET_RECOMMENDATION_BY_MODE = {
  generic: 'db4: robust general-purpose orthogonal basis for mixed content.',
  music: 'db8: good detail retention for harmonic instrument mixtures.',
  animal: 'sym8: smoother reconstruction for complex bioacoustic textures.',
  human: 'Sym5: smooth reconstruction and good speech-formant behavior.',
  ecg: 'bior3.5: common ECG-friendly biorthogonal basis.'
};

const normalizeWaveletName = (waveletName, fallback = 'db4') => {
  const raw = String(waveletName || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'biorthogonal3.5' || raw === 'bior35') return 'bior3.5';
  if (WAVELET_BASIS_MAP[raw]) return raw;
  return fallback;
};

const getModeWaveletDefault = (modeId) => MODE_DEFAULT_WAVELET[modeId] || 'db4';

const computeMaxWaveletLevel = (signalLength, waveletName, fallback = DEFAULT_WAVELET_LEVEL) => {
  const n = Number(signalLength);
  if (!Number.isFinite(n) || n < 2) return fallback;

  const key = normalizeWaveletName(waveletName, 'db4');
  const decLen = WAVELET_DEC_LEN[key] || WAVELET_DEC_LEN.db4;
  const denom = Math.max(1, decLen - 1);
  const ratio = n / denom;
  if (ratio <= 1) return 1;

  return Math.max(1, Math.floor(Math.log2(ratio)));
};

const makeWaveletLevelLabels = (count) => {
  const n = Math.max(1, Number(count) || DEFAULT_WAVELET_LEVEL);
  return Array.from({ length: n }, (_, i) => `L${i + 1}`);
};

const buildWaveletDefaults = (count = DEFAULT_WAVELET_LEVEL) => {
  const n = Math.max(1, Number(count) || DEFAULT_WAVELET_LEVEL);
  return Array.from({ length: n }, () => 1);
};

const normalizeWaveletSliders = (sliders, levelCount) => {
  const defaults = buildWaveletDefaults(levelCount);
  if (!Array.isArray(sliders) || sliders.length === 0) return defaults;

  return defaults.map((d, i) => {
    const n = Number(sliders[i]);
    return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : d;
  });
};

const describeWaveletLevel = (level, sampleRate) => {
  const sr = Math.max(1, Number(sampleRate) || 44100);
  const high = sr / (2 ** level);
  const low = sr / (2 ** (level + 1));
  const lowLabel = low >= 1000 ? `${(low / 1000).toFixed(2)} kHz` : `${Math.round(low)} Hz`;
  const highLabel = high >= 1000 ? `${(high / 1000).toFixed(2)} kHz` : `${Math.round(high)} Hz`;

  if (level === 1) {
    return `L1 (${lowLabel}-${highLabel}): increase to boost the sharpest transients and brightness.`;
  }
  if (level <= 3) {
    return `L${level} (${lowLabel}-${highLabel}): increase for more presence/attack, reduce for smoother output.`;
  }
  if (level <= 5) {
    return `L${level} (${lowLabel}-${highLabel}): increase for body and articulation, reduce for softer mids.`;
  }

  return `L${level} (${lowLabel}-${highLabel}): increase for low-frequency energy and envelope, reduce rumble/boom.`;
};

function App() {
  const MIN_PLAYBACK_SAMPLE_RATE = 3000;
  const MAX_PLAYBACK_SAMPLE_RATE = 192000;

  const [view, setView] = useState('landing'); // 'landing' | 'workspace'
  const [homeMode, setHomeMode] = useState('Home');
  const [activeModeId, setActiveModeId] = useState('generic');
  const [audiogram, setAudiogram] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [inputSpecColorScale, setInputSpecColorScale] = useState('inferno');
  const [outputSpecColorScale, setOutputSpecColorScale] = useState('viridis');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [bandPresetModalOpen, setBandPresetModalOpen] = useState(false);
  const [signalUploaderOpen, setSignalUploaderOpen] = useState(false);
  // Store uploaded signals per mode to isolate uploads
  const [modeUploadedSignals, setModeUploadedSignals] = useState({});
  const [modeUploadedSampleRates, setModeUploadedSampleRates] = useState({});
  const [modeAudioFiles, setModeAudioFiles] = useState({});

  // Get uploaded signal for current mode
  const uploadedSignal = modeUploadedSignals[activeModeId] || null;
  const uploadedSampleRate = modeUploadedSampleRates[activeModeId] || 44100;
  const audioFile = modeAudioFiles[activeModeId] || null;

  // Unified band configuration for all modes
  const [modeFreqConfig, setModeFreqConfig] = useState(DEFAULT_MODE_BANDS);

  // Per-mode wavelet settings - ensure each mode has independent state
  const [modeWaveletTypes, setModeWaveletTypes] = useState(() => {
    const initial = {};
    MODES.forEach(mode => {
      initial[mode.id] = getModeWaveletDefault(mode.id);
    });
    return initial;
  });

  const [modeWaveletSliders, setModeWaveletSliders] = useState(() => {
    const initial = {};
    MODES.forEach(mode => {
      initial[mode.id] = buildWaveletDefaults(DEFAULT_WAVELET_LEVEL);
    });
    return initial;
  });

  // Derived values for current mode
  const waveletType = modeWaveletTypes[activeModeId] || getModeWaveletDefault(activeModeId);
  const waveletSliders = modeWaveletSliders[activeModeId] || buildWaveletDefaults(DEFAULT_WAVELET_LEVEL);

  // Functions to update mode-specific wavelet state - stable references
  const updateWaveletType = (modeId, newType) => {
    setModeWaveletTypes(prev => ({
      ...prev,
      [modeId]: newType
    }));
  };

  const updateWaveletSliders = (modeId, newSliders) => {
    setModeWaveletSliders(prev => ({
      ...prev,
      [modeId]: newSliders
    }));
  };

  // Convenience functions for current mode
  const setWaveletType = (newType) => updateWaveletType(activeModeId, newType);
  const setWaveletSliders = (newSliders) => updateWaveletSliders(activeModeId, newSliders);

  const [processingMethod, setProcessingMethod] = useState('fft');
  const [equalizerTab, setEqualizerTab] = useState('equalizer'); // 'equalizer' | 'ai'
  const [aiComponents, setAiComponents] = useState([]);
  const [aiModeFreqConfig, setAiModeFreqConfig] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiComparisonView, setAiComparisonView] = useState('ai'); // 'ai' | 'static'
  // Linked viewer window (0-1 normalized signal range) shared by input and output.
  const [linkedViewWindow, setLinkedViewWindow] = useState({ start: 0, end: 1 });
  const [fftZoomWindow, setFftZoomWindow] = useState({ x: null, y: null });

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const rafRef = useRef(null);
  const offsetTimeRef = useRef(0);
  const playbackSampleRateRef = useRef(44100);
  const prevOutputSignalRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const aiPresetFileInputRef = useRef(null);

  const activeMode = MODES.find((m) => m.id === activeModeId) || MODES[0];
  const isGenericMode = activeModeId === 'generic';
  const activeWaveletBasis = WAVELET_BASIS_MAP[normalizeWaveletName(waveletType, getModeWaveletDefault(activeModeId))] || WAVELET_BASIS_MAP.db4;
  const recommendedWavelet = WAVELET_RECOMMENDATION_BY_MODE[activeModeId] || WAVELET_RECOMMENDATION_BY_MODE.generic;

  // Get frequency bands for current mode
  const modeFreqBands = modeFreqConfig[activeModeId] || DEFAULT_MODE_BANDS[activeModeId] || [];
  const aiModeFreqBands = aiModeFreqConfig[activeModeId] || [];

  // Update frequency bands for current mode
  const setModeFreqBands = (bands) => {
    setModeFreqConfig(prev => ({
      ...prev,
      [activeModeId]: bands
    }));
  };

  const setAiModeFreqBands = (bands) => {
    setAiModeFreqConfig(prev => ({
      ...prev,
      [activeModeId]: bands
    }));
  };

  const resetAiSeparationState = (modeId = activeModeId) => {
    setAiLoading(false);
    setAiError('');
    setAiComponents([]);
    setAiModeFreqConfig((prev) => ({
      ...prev,
      [modeId]: []
    }));
  };

  const activeProcessingBands = useMemo(() => {
    if (equalizerTab === 'ai' && Array.isArray(aiModeFreqBands) && aiModeFreqBands.length > 0) {
      return aiModeFreqBands;
    }
    return modeFreqBands;
  }, [equalizerTab, aiModeFreqBands, modeFreqBands]);

  const mockSignalData = useMockProcessing({
    modeId: activeModeId,
    freqSliders: activeProcessingBands.map((b) => Number(b.gain) || 1),
    waveletSliders,
    genericBands: activeProcessingBands,
    waveletType,
    inputSignal: uploadedSignal,
    sampleRate: uploadedSampleRate
  });

  const currentSignalLength =
    (Array.isArray(uploadedSignal) && uploadedSignal.length > 0 ? uploadedSignal.length : 0)
    || (Array.isArray(mockSignalData?.input_signal) ? mockSignalData.input_signal.length : 0)
    || 0;
  const maxWaveletLevel = computeMaxWaveletLevel(currentSignalLength, waveletType, DEFAULT_WAVELET_LEVEL);
  const waveletLevelLabels = makeWaveletLevelLabels(maxWaveletLevel);
  const waveletLevel = maxWaveletLevel;

  const { data: backendSignalData, error: backendProcessingError } = useBackendProcessing({
    modeId: activeModeId,
    freqSliders: activeProcessingBands.map((b) => Number(b.gain) || 1),
    genericBands: activeProcessingBands,
    waveletType,
    waveletLevel,
    sampleRate: uploadedSampleRate,
    signalData: uploadedSignal || null,
    useFallback: true,
    processingMethod,
    waveletSliders
  });

  // Prefer backend processing when a real uploaded signal exists.
  const signalData = useMemo(() => {
    if (!uploadedSignal) return mockSignalData;
    if (backendSignalData) return backendSignalData;

    // Backend unavailable/slow: keep controls responsive with local mock processing.
    return mockSignalData;
  }, [uploadedSignal, backendSignalData, mockSignalData]);

  const sharedSpectrogramMax = useMemo(() => {
    const specIn = signalData?.spectrogram?.in;
    if (!specIn) return null;
    let maxVal = 1e-8;

    const scan = (matrix) => {
      if (!Array.isArray(matrix)) return;
      for (let r = 0; r < matrix.length; r += 1) {
        const row = matrix[r];
        if (Array.isArray(row)) {
          for (let c = 0; c < row.length; c += 1) {
            const v = Number(row[c]);
            if (!Number.isNaN(v) && v > maxVal) maxVal = v;
          }
        } else {
          const v = Number(row);
          if (!Number.isNaN(v) && v > maxVal) maxVal = v;
        }
      }
    };

    scan(specIn);

    if (!(maxVal > 0)) {
      return null;
    }

    return maxVal;
  }, [signalData?.spectrogram?.in]);

  const sharedWaveformMax = useMemo(() => {
    const inSignal = signalData?.input_signal;
    if (!Array.isArray(inSignal)) return null;

    let maxVal = 1e-8;
    const scan = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i += 1) {
        const v = Math.abs(Number(arr[i]) || 0);
        if (v > maxVal) maxVal = v;
      }
    };

    scan(inSignal);
    return maxVal;
  }, [signalData?.input_signal]);

  const computeRms = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const v = Number(arr[i]);
      if (Number.isFinite(v)) {
        sumSq += v * v;
        count += 1;
      }
    }
    if (!count) return 0;
    return Math.sqrt(sumSq / count);
  };

  const computeCorrelation = (reference, test) => {
    if (!Array.isArray(reference) || !Array.isArray(test)) return 0;
    const n = Math.min(reference.length, test.length);
    if (n < 2) return 0;

    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;
    let count = 0;

    for (let i = 0; i < n; i += 1) {
      const x = Number(reference[i]);
      const y = Number(test[i]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumYY += y * y;
      sumXY += x * y;
      count += 1;
    }

    if (count < 2) return 0;
    const num = (count * sumXY) - (sumX * sumY);
    const denA = (count * sumXX) - (sumX * sumX);
    const denB = (count * sumYY) - (sumY * sumY);
    const den = Math.sqrt(Math.max(denA, 0) * Math.max(denB, 0));
    if (!(den > 0)) return 0;
    return num / den;
  };

  const computeSNR = (reference, test) => {
    if (!Array.isArray(reference) || !Array.isArray(test)) return 0;
    const n = Math.min(reference.length, test.length);
    if (n === 0) return 0;

    let sig = 0;
    let noise = 0;
    let count = 0;

    for (let i = 0; i < n; i += 1) {
      const r = Number(reference[i]);
      const t = Number(test[i]);
      if (!Number.isFinite(r) || !Number.isFinite(t)) continue;
      const e = r - t;
      sig += r * r;
      noise += e * e;
      count += 1;
    }

    if (!count || sig <= 1e-12) return 0;
    if (noise <= 1e-12) return 120;
    return 10 * Math.log10(sig / noise);
  };

  const computeComparisonMetrics = (modelSignal, dspSignal) => {
    const modelRms = computeRms(modelSignal);
    const dspRms = computeRms(dspSignal);
    const snr = computeSNR(modelSignal, dspSignal);
    const correlation = computeCorrelation(modelSignal, dspSignal);
    return { modelRms, dspRms, snr, correlation };
  };

  const cloneBands = (bands) => (Array.isArray(bands) ? bands.map((b, i) => ({
    id: String(b?.id || `${activeModeId}-ai-${i}`),
    name: String(b?.name || `Component ${i + 1}`),
    low: Number(b?.low) || 0,
    high: Number(b?.high) || 1,
    gain: Number.isFinite(Number(b?.gain)) ? Number(b.gain) : 1
  })) : []);

  const canonicalBandName = (name) => {
    const key = String(name || '').trim().toLowerCase();
    if (key === 'others') return 'other';
    return key;
  };

  const findBandIndexByName = (bands, name) => {
    const target = canonicalBandName(name);
    if (!target) return -1;
    const list = Array.isArray(bands) ? bands : [];
    for (let i = 0; i < list.length; i += 1) {
      const candidate = canonicalBandName(list[i]?.name);
      if (candidate && candidate === target) return i;
    }
    return -1;
  };

  const runAiSeparation = async () => {
    const inputSignal = signalData?.input_signal;
    if (!Array.isArray(inputSignal) || inputSignal.length === 0) {
      setAiError('No input signal available. Upload or load a signal first.');
      setAiComponents([]);
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const sr = Number(uploadedSampleRate) || (activeModeId === 'ecg' ? 500 : 44100);
      const srInt = Math.max(1, Math.round(sr));

      if (activeModeId === 'music') {
        const demucsResponse = await separateMusicModeDemucs(inputSignal, [], srInt, 'htdemucs_6s');
        const rawComponents = Array.isArray(demucsResponse?.data?.components) ? demucsResponse.data.components : [];
        if (!rawComponents.length) {
          throw new Error('Demucs returned no components for this file.');
        }

        const previousBands = Array.isArray(aiModeFreqBands) && aiModeFreqBands.length
          ? aiModeFreqBands
          : modeFreqBands;
        const gainByName = (Array.isArray(previousBands) ? previousBands : []).reduce((acc, band) => {
          acc[String(band?.name || '').toLowerCase()] = Number(band?.gain) || 1;
          return acc;
        }, {});

        const autoBands = rawComponents.map((comp, idx) => {
          const name = String(comp?.name || `source-${idx + 1}`);
          const key = name.toLowerCase();
          const low = Math.max(0, Number(comp?.low) || 20);
          const high = Math.max(low + 1, Number(comp?.high) || 20000);
          return {
            id: `music-${idx}`,
            name,
            low,
            high,
            gain: Number.isFinite(gainByName[key]) ? gainByName[key] : 1
          };
        });
        setAiModeFreqConfig((prev) => ({ ...prev, music: autoBands }));

        const extracted = autoBands.map((band, idx) => {
          const modelComp = rawComponents[idx] || {};
          const modelSignal = Array.isArray(modelComp?.signal) ? modelComp.signal : [];
          const relativeStemUrl = String(modelComp?.stem_url || '');
          const modelStemUrl = relativeStemUrl
            ? (relativeStemUrl.startsWith('http') ? relativeStemUrl : `${API_BASE_URL}${relativeStemUrl}`)
            : '';

          return {
            id: band.id,
            name: band.name,
            low: band.low,
            high: band.high,
            modelRms: Number.isFinite(Number(modelComp?.rms)) ? Number(modelComp.rms) : computeRms(modelSignal),
            modelStemUrl,
            stemFilename: String(modelComp?.stem_filename || ''),
            source: String(modelComp?.source || band.name),
            modelSignal,
            compareAi: null,
            compareStatic: null
          };
        });

        setAiComponents(extracted);
        return;
      }

      const baseAiBands = cloneBands(
        (Array.isArray(aiModeFreqBands) && aiModeFreqBands.length > 0) ? aiModeFreqBands : modeFreqBands
      );
      if (!baseAiBands.length) {
        setAiError('No bands/components are configured for this mode.');
        setAiComponents([]);
        return;
      }
      if (!aiModeFreqBands.length) {
        setAiModeFreqBands(baseAiBands);
      }

      const names = baseAiBands.map((b, i) => String(b?.name || `Component ${i + 1}`));
      const componentRequests = baseAiBands.map((_, idx) => {
        const oneHot = baseAiBands.map((band, i) => (i === idx ? (Number(band?.gain) || 1) : 0));

        if (activeModeId === 'animal') {
          return processAnimalsMode(inputSignal, oneHot, names, srInt, 'fft', waveletType, 6, null);
        }
        if (activeModeId === 'human') {
          return processHumansMode(inputSignal, oneHot, names, srInt, 'fft', waveletType, 6, null);
        }
        if (activeModeId === 'ecg') {
          return processECGMode(inputSignal, oneHot, names, srInt, 'fft', waveletType, 6, null);
        }

        const singleBandConfig = baseAiBands.map((b, i) => ({ ...b, gain: i === idx ? (Number(b?.gain) || 1) : 0 }));
        return processGenericMode(inputSignal, singleBandConfig, srInt);
      });

      const responses = await Promise.all(componentRequests);
      const extracted = responses.map((resp, idx) => {
        const out = Array.isArray(resp?.data?.output_signal) ? resp.data.output_signal : [];
        return {
          id: baseAiBands[idx]?.id || `ai-${idx}`,
          name: names[idx],
          signal: out,
          rms: computeRms(out)
        };
      });

      setAiComponents(extracted);
    } catch (err) {
      setAiComponents([]);
      setAiError(err?.response?.data?.detail || err?.message || 'AI separation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const runAiComparison = async () => {
    const inputSignal = signalData?.input_signal;
    if (activeModeId !== 'music') {
      setAiError('AI comparison is only available for Music mode.');
      return;
    }
    if (!Array.isArray(aiComponents) || aiComponents.length === 0) {
      setAiError('Run AI Separation first to create stems for comparison.');
      return;
    }
    if (!Array.isArray(inputSignal) || inputSignal.length === 0) {
      setAiError('No input signal available. Upload or load a signal first.');
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const sr = Number(uploadedSampleRate) || 44100;
      const srInt = Math.max(1, Math.round(sr));
      const method = processingMethod === 'wavelet' ? 'wavelet' : 'fft';
      const aiWaveletSliders = method === 'wavelet'
        ? normalizeWaveletSliders(waveletSliders, maxWaveletLevel)
        : null;

      const aiBands = (Array.isArray(aiModeFreqBands) && aiModeFreqBands.length > 0)
        ? aiModeFreqBands
        : aiComponents.map((comp, idx) => ({
          id: String(comp?.id || `music-${idx}`),
          name: String(comp?.name || `Component ${idx + 1}`),
          low: Number(comp?.low) || 0,
          high: Number(comp?.high) || 1,
          gain: 1
        }));
      const aiNames = aiBands.map((b) => b.name);

      const aiRequests = aiBands.map((_, idx) => {
        const oneHot = aiBands.map((band, i) => (i === idx ? (Number(band?.gain) || 1) : 0));
        return processMusicMode(
          inputSignal,
          oneHot,
          aiNames,
          srInt,
          method,
          waveletType,
          maxWaveletLevel,
          aiWaveletSliders,
          aiBands
        );
      });
      const aiResponses = await Promise.all(aiRequests);
      const aiDspSignals = aiResponses.map((resp) => (
        Array.isArray(resp?.data?.output_signal) ? resp.data.output_signal : []
      ));

      const staticBands = Array.isArray(modeFreqBands) ? modeFreqBands : [];
      const staticNames = staticBands.map((b) => b.name);
      const staticRequests = staticBands.map((_, idx) => {
        const oneHot = staticBands.map((band, i) => (i === idx ? (Number(band?.gain) || 1) : 0));
        return processMusicMode(
          inputSignal,
          oneHot,
          staticNames,
          srInt,
          method,
          waveletType,
          maxWaveletLevel,
          aiWaveletSliders,
          staticBands
        );
      });
      const staticResponses = await Promise.all(staticRequests);
      const staticDspSignals = staticResponses.map((resp) => (
        Array.isArray(resp?.data?.output_signal) ? resp.data.output_signal : []
      ));

      const updated = aiComponents.map((comp, idx) => {
        const modelSignal = Array.isArray(comp?.modelSignal) ? comp.modelSignal : [];
        const aiDspSignal = Array.isArray(aiDspSignals[idx]) ? aiDspSignals[idx] : [];
        const compareAi = computeComparisonMetrics(modelSignal, aiDspSignal);

        const namedIndex = findBandIndexByName(staticBands, comp?.name);
        const fallbackIndex = idx < staticBands.length ? idx : -1;
        const staticIndex = namedIndex >= 0 ? namedIndex : fallbackIndex;
        const staticDspSignal = staticIndex >= 0 && Array.isArray(staticDspSignals[staticIndex])
          ? staticDspSignals[staticIndex]
          : [];
        const compareStatic = computeComparisonMetrics(modelSignal, staticDspSignal);

        return {
          ...comp,
          compareAi,
          compareStatic,
          staticBandName: staticIndex >= 0 ? String(staticBands[staticIndex]?.name || '') : ''
        };
      });

      setAiComponents(updated);
    } catch (err) {
      setAiError(err?.response?.data?.detail || err?.message || 'AI comparison failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSoloToEqualizer = (componentIndex) => {
    const selected = aiComponents[componentIndex];
    const selectedName = String(selected?.name || '').toLowerCase();
    setModeFreqBands(modeFreqBands.map((b, i) => {
      const byNameMatch = selectedName && String(b?.name || '').toLowerCase() === selectedName;
      const byIndexMatch = i === componentIndex;
      return { ...b, gain: (byNameMatch || (!selectedName && byIndexMatch)) ? 1 : 0 };
    }));
    setEqualizerTab('equalizer');
  };

  const aiBandsComparisonSummary = useMemo(() => {
    if (activeModeId !== 'music' || !Array.isArray(aiComponents) || aiComponents.length === 0) {
      return null;
    }
    const items = aiComponents
      .map((c) => c?.compareAi)
      .filter((c) => c && (Number.isFinite(Number(c?.snr)) || Number.isFinite(Number(c?.correlation))));
    if (!items.length) return null;

    const avgSNR = items.reduce((s, c) => s + (Number(c?.snr) || 0), 0) / items.length;
    const avgCorrelation = items.reduce((s, c) => s + (Number(c?.correlation) || 0), 0) / items.length;
    const avgModelRms = items.reduce((s, c) => s + (Number(c?.modelRms) || 0), 0) / items.length;
    const avgDspRms = items.reduce((s, c) => s + (Number(c?.dspRms) || 0), 0) / items.length;

    return {
      avgSNR,
      avgCorrelation,
      avgModelRms,
      avgDspRms
    };
  }, [activeModeId, aiComponents]);

  const staticBandsComparisonSummary = useMemo(() => {
    if (activeModeId !== 'music' || !Array.isArray(aiComponents) || aiComponents.length === 0) {
      return null;
    }
    const items = aiComponents
      .map((c) => c?.compareStatic)
      .filter((c) => c && (Number.isFinite(Number(c?.snr)) || Number.isFinite(Number(c?.correlation))));
    if (!items.length) return null;

    const avgSNR = items.reduce((s, c) => s + (Number(c?.snr) || 0), 0) / items.length;
    const avgCorrelation = items.reduce((s, c) => s + (Number(c?.correlation) || 0), 0) / items.length;
    const avgModelRms = items.reduce((s, c) => s + (Number(c?.modelRms) || 0), 0) / items.length;
    const avgDspRms = items.reduce((s, c) => s + (Number(c?.dspRms) || 0), 0) / items.length;

    return {
      avgSNR,
      avgCorrelation,
      avgModelRms,
      avgDspRms
    };
  }, [activeModeId, aiComponents]);

  useEffect(() => {
    if (signalData?.time?.length) {
      durationRef.current = signalData.time[signalData.time.length - 1];
    }
  }, [signalData]);

  useEffect(() => {
    // Reset FFT zoom only when visualization context changes,
    // not on every processed data object refresh.
    setFftZoomWindow({ x: null, y: null });
  }, [activeModeId, audiogram, uploadedSignal, uploadedSampleRate]);

  useEffect(() => {
    // Apply researched per-mode default wavelet basis before any backend defaults arrive.
    if (activeModeId === 'generic') {
      setProcessingMethod('fft');
      return;
    }
    const modeDefault = getModeWaveletDefault(activeModeId);
    setWaveletType(modeDefault);
    setWaveletSliders(buildWaveletDefaults(DEFAULT_WAVELET_LEVEL));
  }, [activeModeId]);

  useEffect(() => {
    if (isGenericMode) return;
    setWaveletSliders((prev) => normalizeWaveletSliders(prev, maxWaveletLevel));
  }, [isGenericMode, maxWaveletLevel, waveletType]);

  // Load default settings when mode changes
  // Ensure graphs are clear when switching to a mode without an uploaded signal
  useEffect(() => {
    // When switching modes, if the new mode has no uploaded signal, ensure clean state
    if (!uploadedSignal) {
      // Signal will be null, graphs will show empty from useMockProcessing
    }
    // Also reset playback when switching modes
    handleStop();
  }, [activeModeId]);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        let response;
        switch (activeModeId) {
          case 'generic':
            response = await getGenericDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                generic: response.data.bands
              }));
            }
            break;
          case 'music':
            response = await getMusicDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                music: response.data.bands
              }));
            }
            {
              const selectedWavelet = normalizeWaveletName(response.data?.wavelet, getModeWaveletDefault('music'));
              setWaveletType(selectedWavelet);
              setWaveletSliders(normalizeWaveletSliders(response.data?.sliders_wavelet, maxWaveletLevel));
            }
            break;
          case 'animal':
            response = await getAnimalsDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                animal: response.data.bands
              }));
            }
            {
              const selectedWavelet = normalizeWaveletName(response.data?.wavelet, getModeWaveletDefault('animal'));
              setWaveletType(selectedWavelet);
              setWaveletSliders(normalizeWaveletSliders(response.data?.sliders_wavelet, maxWaveletLevel));
            }
            break;
          case 'human':
            response = await getHumansDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                human: response.data.bands
              }));
            }
            {
              const selectedWavelet = normalizeWaveletName(response.data?.wavelet, getModeWaveletDefault('human'));
              setWaveletType(selectedWavelet);
              setWaveletSliders(normalizeWaveletSliders(response.data?.sliders_wavelet, maxWaveletLevel));
            }
            break;
          case 'ecg':
            response = await getECGDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                ecg: response.data.bands
              }));
            }
            {
              const selectedWavelet = normalizeWaveletName(response.data?.wavelet, getModeWaveletDefault('ecg'));
              setWaveletType(selectedWavelet);
              setWaveletSliders(normalizeWaveletSliders(response.data?.sliders_wavelet, maxWaveletLevel));
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.log('Could not load default settings from backend:', error);
        // Silently fail - use whatever defaults are set
      }
    };

    loadDefaults();
  }, [activeModeId]);

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // ignore
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const handlePlay = () => {
    if (!signalData?.output_signal || !signalData?.time) return;

    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
    }

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    stopAudio();

    const dt = signalData.time[1] - signalData.time[0] || 1 / 44100;
    const desiredSampleRate = 1 / dt;
    const playbackSampleRate = Math.max(
      MIN_PLAYBACK_SAMPLE_RATE,
      Math.min(MAX_PLAYBACK_SAMPLE_RATE, Math.round(desiredSampleRate) || 44100)
    );
    playbackSampleRateRef.current = playbackSampleRate;

    let buffer;
    try {
      buffer = ctx.createBuffer(1, signalData.output_signal.length, playbackSampleRate);
    } catch (error) {
      console.error('Failed to create playback buffer:', error);
      window.alert('Playback failed for this file. Try reloading or using a shorter file.');
      return;
    }
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = signalData.output_signal[i];
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gainNode.gain.value = volume;

    source.connect(gainNode).connect(ctx.destination);

    // Add ended event listener to stop playback when audio finishes
    source.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
      offsetTimeRef.current = 0;
    };

    // Calculate offset to resume from paused position
    // Find the sample index corresponding to the current playbackTime
    let offsetTime = 0;
    if (playbackTime > 0 && signalData.time) {
      // Find the closest time index in the signal
      let offsetIndex = 0;
      for (let i = 0; i < signalData.time.length; i++) {
        if (signalData.time[i] >= playbackTime) {
          offsetIndex = i;
          break;
        }
      }
      offsetTime = signalData.time[offsetIndex] || playbackTime;
    }

    const safeOffset = Math.max(0, Math.min(offsetTime, Math.max(0, buffer.duration - 1e-4)));

    try {
      source.start(0, safeOffset);
    } catch (error) {
      console.error('Playback start failed:', error);
      source.start(0, 0);
    }

    sourceRef.current = source;
    gainRef.current = gainNode;
    startTimeRef.current = ctx.currentTime;
    offsetTimeRef.current = safeOffset;
    durationRef.current = signalData.time[signalData.time.length - 1];

    const tick = () => {
      if (!audioCtxRef.current || !sourceRef.current) return;
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
      const clamped = Math.min(offsetTimeRef.current + elapsed, durationRef.current);
      setPlaybackTime(clamped);
      if (offsetTimeRef.current + elapsed < durationRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    setIsPlaying(true);
    prevOutputSignalRef.current = signalData.output_signal;
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePause = () => {
    // Stop the animation frame first to freeze the UI
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Capture current playback time before stopping audio
    if (audioCtxRef.current && sourceRef.current) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
      setPlaybackTime(Math.min(elapsed, durationRef.current));
    }

    // Stop the audio source
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    setIsPlaying(false);
  };

  const handleStop = () => {
    stopAudio();
    setIsPlaying(false);
    setPlaybackTime(0);
    offsetTimeRef.current = 0;
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  // ── Seamless buffer swap when output_signal changes during playback ──
  useEffect(() => {
    const newSignal = signalData?.output_signal;
    if (!newSignal || !isPlaying || !audioCtxRef.current || !sourceRef.current) {
      prevOutputSignalRef.current = newSignal || null;
      return;
    }
    // Skip if the reference is the same (no actual change)
    if (newSignal === prevOutputSignalRef.current) return;
    prevOutputSignalRef.current = newSignal;

    const ctx = audioCtxRef.current;
    // Compute exact current position
    const elapsed = (ctx.currentTime - startTimeRef.current) * playbackRate;
    const currentPos = offsetTimeRef.current + elapsed;
    if (currentPos >= durationRef.current) return;

    // Stop old source
    const oldSource = sourceRef.current;
    try { oldSource.onended = null; oldSource.stop(); } catch { }
    try { oldSource.disconnect(); } catch { }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    // Create new buffer with new signal
    const sr = playbackSampleRateRef.current;
    let buffer;
    try {
      buffer = ctx.createBuffer(1, newSignal.length, sr);
    } catch { return; }
    const bufData = buffer.getChannelData(0);
    for (let i = 0; i < bufData.length; i++) bufData[i] = newSignal[i];

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(gainRef.current);
    source.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
      offsetTimeRef.current = 0;
    };

    const safeOffset = Math.max(0, Math.min(currentPos, buffer.duration - 1e-4));
    try { source.start(0, safeOffset); } catch { source.start(0, 0); }

    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime;
    offsetTimeRef.current = safeOffset;

    // Restart animation tick
    const tick = () => {
      if (!audioCtxRef.current || !sourceRef.current) return;
      const el = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
      const clamped = Math.min(offsetTimeRef.current + el, durationRef.current);
      setPlaybackTime(clamped);
      if (offsetTimeRef.current + el < durationRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalData?.output_signal]);

  // ── Auto-scroll waveform view to follow playback cursor ──
  useEffect(() => {
    if (!isPlaying || !autoScrollEnabledRef.current) return;
    if (!durationRef.current || durationRef.current <= 0) return;

    const normalized = playbackTime / durationRef.current; // 0..1
    const { start, end } = linkedViewWindow;
    const span = end - start;

    // If fully zoomed out, no need to scroll
    if (span >= 0.99) return;

    // If cursor moved past 75% of the visible window, scroll to keep it at 25%
    const cursorInWindow = (normalized - start) / span;
    if (cursorInWindow > 0.75 || cursorInWindow < 0) {
      const newStart = Math.max(0, Math.min(1 - span, normalized - span * 0.25));
      setLinkedViewWindow({ start: newStart, end: newStart + span });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackTime, isPlaying]);

  const handleSpeedChange = (speed) => {
    setPlaybackRate(speed);
    if (sourceRef.current) {
      sourceRef.current.playbackRate.value = speed;
    }
  };

  const handleVolumeChange = (val) => {
    const v = parseFloat(val);
    setVolume(v);
    if (gainRef.current) {
      gainRef.current.gain.value = v;
    }
  };

  const updateViewWindow = (updater) => {
    setLinkedViewWindow((w) => updater(w));
  };

  const linkedZoom = 1 / Math.max(1e-6, linkedViewWindow.end - linkedViewWindow.start);

  // Linked zoom/pan/reset controls for both viewers.
  const zoomFactor = 0.6;
  const panStep = 0.05;
  const minWindowSpan = 0.01;
  const maxWindowSpan = 1;
  const handleZoomIn = () => {
    updateViewWindow((w) => {
      const currentSpan = w.end - w.start;
      if (currentSpan <= minWindowSpan) return w;

      const mid = (w.start + w.end) / 2;
      const span = Math.max(minWindowSpan, currentSpan * zoomFactor);
      const half = span / 2;
      return { start: Math.max(0, mid - half), end: Math.min(1, mid + half) };
    });
  };
  const handleZoomOut = () => {
    updateViewWindow((w) => {
      const currentSpan = w.end - w.start;
      if (currentSpan >= maxWindowSpan) return { start: 0, end: 1 };

      const mid = (w.start + w.end) / 2;
      const span = Math.min(maxWindowSpan, currentSpan / zoomFactor);
      const half = span / 2;
      return { start: Math.max(0, mid - half), end: Math.min(1, mid + half) };
    });
  };
  const handlePanLeft = () => {
    updateViewWindow((w) => {
      const d = w.end - w.start;
      const s = Math.max(0, w.start - panStep);
      return { start: s, end: Math.min(1, s + d) };
    });
  };
  const handlePanRight = () => {
    updateViewWindow((w) => {
      const d = w.end - w.start;
      const e = Math.min(1, w.end + panStep);
      return { start: Math.max(0, e - d), end: e };
    });
  };
  const handleResetView = () => {
    setLinkedViewWindow({ start: 0, end: 1 });
  };

  const handleSavePreset = () => {
    const schema = {
      mode: activeModeId,
      sliders_freq: modeFreqBands.map(b => Number(b.gain) || 1),
      bands: modeFreqBands
    };

    if (!isGenericMode) {
      schema.sliders_wavelet = waveletSliders;
      schema.wavelet = waveletType;
    }

    // Create a blob from the schema JSON
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'equalizer_preset.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL
    URL.revokeObjectURL(url);

    window.alert('Preset downloaded to your Downloads folder!');
  };

  const handleSaveAiPreset = () => {
    if (!Array.isArray(aiModeFreqBands) || aiModeFreqBands.length === 0) {
      window.alert('No AI sliders to save yet. Run AI Separation first.');
      return;
    }

    const schema = {
      mode: activeModeId,
      scope: 'ai_separation',
      sliders_freq: aiModeFreqBands.map((b) => Number(b.gain) || 1),
      bands: aiModeFreqBands
    };

    if (!isGenericMode) {
      schema.sliders_wavelet = waveletSliders;
      schema.wavelet = waveletType;
    }

    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai_separation_preset.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    window.alert('AI preset downloaded to your Downloads folder.');
  };

  const applyAiPresetData = (rawPreset) => {
    const d = rawPreset || {};
    const currentMode = activeModeId;
    const presetMode = d.mode;
    const modeMismatch = Boolean(presetMode) && presetMode !== currentMode;

    if (Array.isArray(d.sliders_freq)) {
      const gains = d.sliders_freq.map((v) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 1;
      });

      setAiModeFreqConfig((prev) => {
        const currentBands = Array.isArray(prev[currentMode]) ? prev[currentMode] : [];
        if (!currentBands.length) return prev;
        return {
          ...prev,
          [currentMode]: currentBands.map((b, i) => ({
            ...b,
            gain: Number.isFinite(gains[i]) ? gains[i] : Number(b.gain) || 1
          }))
        };
      });
    }

    if (currentMode !== 'generic') {
      const selectedWavelet = normalizeWaveletName(d.wavelet, getModeWaveletDefault(currentMode));
      setWaveletType(selectedWavelet);
      setWaveletSliders(normalizeWaveletSliders(d.sliders_wavelet, maxWaveletLevel));
    }

    if (Array.isArray(d.bands) && d.bands.length && !modeMismatch) {
      const normalizedBands = d.bands.map((b, i) => ({
        id: String(b.id || `${currentMode}-ai-${i}`),
        name: String(b.name || `Component ${i + 1}`),
        low: Number(b.low) || 0,
        high: Number(b.high) || 1,
        gain: Number.isFinite(Number(b.gain)) ? Number(b.gain) : 1
      }));

      setAiModeFreqConfig((prev) => ({
        ...prev,
        [currentMode]: normalizedBands
      }));
    }

    if (modeMismatch) {
      window.alert(`AI preset loaded into current mode (${currentMode}). Preset was saved for ${presetMode}, so band layout was not switched.`);
    } else {
      window.alert('AI preset loaded. Controls updated.');
    }
  };

  const handleAiPresetLoadClick = () => {
    if (aiPresetFileInputRef.current) {
      aiPresetFileInputRef.current.value = '';
      aiPresetFileInputRef.current.click();
    }
  };

  const handleAiPresetFileSelected = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      applyAiPresetData(parsed);
    } catch {
      window.alert('Invalid AI preset file. Please select a valid JSON preset.');
    } finally {
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  const handleLoadPreset = () => {
    loadSchema('equalizer_preset.json').then((res) => {
      const d = res.data;
      const currentMode = activeModeId;
      const presetMode = d.mode;
      const modeMismatch = Boolean(presetMode) && presetMode !== currentMode;

      if (Array.isArray(d.sliders_freq)) {
        const gains = d.sliders_freq.map((v) => {
          const n = Number(v);
          return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 1;
        });

        // Keep preset loading in the current mode; never force mode switching.
        setModeFreqConfig((prev) => {
          const currentBands = Array.isArray(prev[currentMode]) ? prev[currentMode] : [];
          if (!currentBands.length) return prev;
          return {
            ...prev,
            [currentMode]: currentBands.map((b, i) => ({
              ...b,
              gain: Number.isFinite(gains[i]) ? gains[i] : Number(b.gain) || 1
            }))
          };
        });
      }

      if (currentMode !== 'generic') {
        const selectedWavelet = normalizeWaveletName(d.wavelet, getModeWaveletDefault(currentMode));
        setWaveletType(selectedWavelet);
        setWaveletSliders(normalizeWaveletSliders(d.sliders_wavelet, maxWaveletLevel));
      }

      if (Array.isArray(d.bands) && d.bands.length && !modeMismatch) {
        setModeFreqConfig(prev => ({
          ...prev,
          [currentMode]: d.bands
        }));
      }

      if (modeMismatch) {
        window.alert(`Preset loaded into current mode (${currentMode}). Preset was saved for ${presetMode}, so band layout was not switched.`);
      } else {
        window.alert('Preset loaded. Controls updated.');
      }
    }).catch(() => {
      window.alert('Load failed. Ensure backend is running and preset file exists.');
    });
  };

  const handleApplyBandPreset = (preset) => {
    if (!preset || !Array.isArray(preset.bands) || !preset.bands.length) return;

    const normalizedBands = preset.bands.map((b, i) => ({
      id: String(b.id || `${preset.mode || activeModeId}-${i}`),
      name: String(b.name || `Band ${i + 1}`),
      low: Number(b.low) || 0,
      high: Number(b.high) || 1,
      gain: Number.isFinite(Number(b.gain)) ? Number(b.gain) : 1
    }));

    const mode = preset.mode || activeModeId;
    if (mode !== activeModeId) {
      setActiveModeId(mode);
    }

    setModeFreqConfig(prev => ({
      ...prev,
      [mode]: normalizedBands
    }));
  };

  const handleSettingsSelect = (settings) => {
    if (!settings) return;

    // Apply settings to current mode
    if (settings.mode) {
      setActiveModeId(settings.mode);
    }

    // Slider gains are stored in band configurations, not as separate state

    const selectedMode = settings.mode || activeModeId;
    if (selectedMode !== 'generic') {
      const selectedWavelet = normalizeWaveletName(settings.wavelet, getModeWaveletDefault(selectedMode));
      setWaveletType(selectedWavelet);
      setWaveletSliders(normalizeWaveletSliders(settings.sliders_wavelet, maxWaveletLevel));
    }

    // Apply band configurations for the mode
    if (settings.bands && Array.isArray(settings.bands)) {
      const normalizedBands = settings.bands.map((b, i) => ({
        id: b.id || `${settings.mode || activeModeId}-${i}`,
        name: b.name || `Channel ${i + 1}`,
        low: Number(b.low) || 0,
        high: Number(b.high) || 1,
        gain: Number(b.gain) ?? 1
      }));
      setModeFreqConfig(prev => ({
        ...prev,
        [settings.mode || activeModeId]: normalizedBands
      }));
    }

    window.alert('Settings loaded successfully. Controls updated.');
  };

  const normalizeUploadedSignal = (signal, sampleRate) => {
    if (!signal || signal.length === 0) {
      return { signal: [], sampleRate: Number(sampleRate) || 44100 };
    }

    // Preserve exact uploaded content. Downsampling here changes playback pitch/timbre.
    return {
      signal: Array.from(signal, (v) => Number(v) || 0),
      sampleRate: Number(sampleRate) || 44100
    };
  };

  const handleModeSignalLoad = (signal, sampleRate, filename) => {
    // Reset transport to avoid stale offsets from previous files.
    handleStop();
    // Reset AI Separation state for the current mode whenever a new signal is loaded.
    resetAiSeparationState(activeModeId);

    const normalized = normalizeUploadedSignal(signal, sampleRate);

    // Store the actual uploaded signal data for current mode
    setModeUploadedSignals(prev => ({
      ...prev,
      [activeModeId]: normalized.signal
    }));
    setModeUploadedSampleRates(prev => ({
      ...prev,
      [activeModeId]: normalized.sampleRate
    }));
    // Also update the audioFile name for display (per mode)
    setModeAudioFiles(prev => ({
      ...prev,
      [activeModeId]: {
        name: filename,
        size: normalized.signal.length * 4,
        type: 'audio/wav'
      }
    }));
  };

  const decodeAudioFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const channel = decoded.getChannelData(0);
      const normalized = normalizeUploadedSignal(channel, decoded.sampleRate);
      return {
        signal: normalized.signal,
        sampleRate: normalized.sampleRate
      };
    } finally {
      await audioCtx.close();
    }
  };

  const handleExport = () => {
    if (!signalData?.output_signal || !signalData.output_signal.length) {
      window.alert('No output signal to export. Load a signal and apply equalization first.');
      return;
    }

    const samples = signalData.output_signal;
    const sr = uploadedSampleRate || 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sr * blockAlign;
    const dataSize = samples.length * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // RIFF header
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeStr(8, 'WAVE');
    // fmt sub-chunk
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true);  // Audio format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data sub-chunk
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, Number(samples[i]) || 0));
      view.setInt16(44 + i * 2, clamped * 0x7FFF, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeModeId}_equalized.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAudioFileSelect = async (file) => {
    // Reset transport so the new file always starts from t=0.
    handleStop();
    // Reset AI Separation state for the current mode whenever a new signal is loaded.
    resetAiSeparationState(activeModeId);

    // Always show selected file name immediately.
    setModeAudioFiles(prev => ({
      ...prev,
      [activeModeId]: file
    }));

    try {
      const response = await uploadAudio(file);
      const backendSignal = response?.data?.signal;
      const backendSampleRate = response?.data?.audio?.sample_rate;

      if (Array.isArray(backendSignal) && backendSignal.length > 0) {
        const normalized = normalizeUploadedSignal(backendSignal, backendSampleRate);
        setModeUploadedSignals(prev => ({
          ...prev,
          [activeModeId]: normalized.signal
        }));
        setModeUploadedSampleRates(prev => ({
          ...prev,
          [activeModeId]: normalized.sampleRate
        }));
        return;
      }

      // Backend truncates large payloads; decode locally when no signal is returned.
      const decoded = await decodeAudioFile(file);
      setModeUploadedSignals(prev => ({
        ...prev,
        [activeModeId]: decoded.signal
      }));
      setModeUploadedSampleRates(prev => ({
        ...prev,
        [activeModeId]: decoded.sampleRate || 44100
      }));
    } catch (error) {
      // If backend is unavailable, still load locally so UI remains usable.
      try {
        const decoded = await decodeAudioFile(file);
        setModeUploadedSignals(prev => ({
          ...prev,
          [activeModeId]: decoded.signal
        }));
        setModeUploadedSampleRates(prev => ({
          ...prev,
          [activeModeId]: decoded.sampleRate || 44100
        }));
      } catch (decodeError) {
        console.error('Could not load selected audio file:', decodeError);
        window.alert('Could not load this audio file. Please try WAV/MP3 with a supported codec.');
      }
    }
  };

  const goToMode = (id) => {
    setActiveModeId(id);
    setView('workspace');
  };

  // --- Landing screen ---
  if (view === 'landing') {
    return (
      <div className="app-layout">
        <div className="animated-background">
          <div className="signal-track track-3"></div>
          <div className="signal-track track-2"></div>
          <div className="signal-track track-1"></div>
        </div>

        <main className="main-content">
          <div className="home-dashboard">
            <h1 className="hero-title">Advanced Signal Equalizer</h1>
            <p className="hero-subtitle">Select an isolation mode to begin frequency analysis</p>

            <div className="cards-wrapper">
              <div className="connecting-line"></div>

              <div className="cards-container">
                {LANDING_MODES.map((mode) => (
                  <div
                    key={mode.id}
                    className="mode-card-wrapper"
                    onClick={() => goToMode(mode.id)}
                  >
                    <div className="mode-card">
                      <div className="card-node-dot"></div>
                      <h3>{mode.title}</h3>
                      <p>{mode.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app workspace-app">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <button type="button" className="workspace-home" onClick={() => setView('landing')} title="Back to main">
            <span className="workspace-icon" aria-hidden>◇</span>
          </button>
          <div>
            <h1 className="workspace-title">{activeMode.name}</h1>
            <p className="workspace-filename">{audioFile?.name || activeMode.tag || 'No file loaded'}</p>
          </div>
        </div>
        <div className="workspace-header-right">
          <button type="button" className="btn btn-header" onClick={() => setView('landing')}>
            <span className="btn-icon">⌂</span> Main
          </button>
          <button type="button" className="btn btn-header" onClick={() => setModeModalOpen(true)}>
            <span className="btn-icon">⚙</span> Change Mode
          </button>
          <button
            type="button"
            className="btn btn-header"
            onClick={() => setSignalUploaderOpen(true)}
            title="Upload signal for Music mode"
          >
            <span className="btn-icon">📁</span> Mode Signals
          </button>
          <button type="button" className="btn btn-export" onClick={handleExport}>
            <span className="btn-icon">↓</span> Export
          </button>
        </div>
      </header>

      <div className="workspace-tabs">
        <button
          type="button"
          className={`workspace-tab ${equalizerTab === 'equalizer' ? 'active' : ''}`}
          onClick={() => setEqualizerTab('equalizer')}
        >
          Equalizer Mode
        </button>
        <button
          type="button"
          className={`workspace-tab ${equalizerTab === 'ai' ? 'active' : ''}`}
          onClick={() => setEqualizerTab('ai')}
        >
          AI Separation
        </button>
      </div>

      <ModeModal
        open={modeModalOpen}
        modes={MODES}
        activeModeId={activeModeId}
        onClose={() => setModeModalOpen(false)}
        onSelect={(id) => {
          setActiveModeId(id);
          setModeModalOpen(false);
        }}
      />

      <BandPresetModal
        open={bandPresetModalOpen}
        onClose={() => setBandPresetModalOpen(false)}
        activeModeId={activeModeId}
        bands={modeFreqBands}
        onApplyPreset={handleApplyBandPreset}
      />

      {signalUploaderOpen && (
        <ModeSignalUploader
          mode={activeModeId}
          onSignalLoad={handleModeSignalLoad}
          onClose={() => setSignalUploaderOpen(false)}
        />
      )}

      <div className="workspace-body">
        <aside className="workspace-left">
          {equalizerTab === 'equalizer' && (
            <div className="box equalizer-box">
              <div className="box-head">
                <h2 className="box-title">Equalizer Controls</h2>
                <div className="box-actions">
                  <div className="method-toggle" style={{ marginRight: '1rem', display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '4px' }}>
                    <button
                      type="button"
                      className={`btn-xs ${processingMethod === 'fft' ? 'active' : ''}`}
                      onClick={() => setProcessingMethod('fft')}
                      style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: processingMethod === 'fft' ? '#6366f1' : 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}
                    >FFT</button>
                    {!isGenericMode && (
                      <button
                        type="button"
                        className={`btn-xs ${processingMethod === 'wavelet' ? 'active' : ''}`}
                        onClick={() => setProcessingMethod('wavelet')}
                        style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: processingMethod === 'wavelet' ? '#6366f1' : 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}
                      >Wavelet</button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setModeFreqBands(modeFreqBands.map((b) => ({ ...b, gain: 1 })));
                      if (processingMethod === 'wavelet' && !isGenericMode) {
                        setWaveletSliders(buildWaveletDefaults(maxWaveletLevel));
                      }
                    }}
                    title="Reset"
                  >↺</button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setBandPresetModalOpen(true)}
                    title="Band presets"
                  >🗂</button>
                  <button type="button" className="icon-btn" onClick={handleSavePreset} title="Save">💾</button>
                </div>
              </div>
              <div className="equalizer-scroll-container">
                {uploadedSignal && backendProcessingError && (
                  <p className="helper-text" style={{ color: '#fda4af', marginBottom: '0.6rem' }}>
                    Backend processing is currently unavailable, showing local preview processing so sliders remain responsive.
                  </p>
                )}

                {/* Equalizer Curve - Works for all modes */}
                <EqualizerCurve
                  labels={
                    (activeModeId === 'generic' || (modeFreqBands && modeFreqBands.length > 0))
                      ? modeFreqBands.map((b) => b.name)
                      : []
                  }
                  values={
                    (activeModeId === 'generic' || (modeFreqBands && modeFreqBands.length > 0))
                      ? modeFreqBands.map((b) => Number(b.gain))
                      : []
                  }
                  onChange={(vals) => {
                    setModeFreqBands(modeFreqBands.map((b, i) => ({ ...b, gain: vals[i] })));
                  }}
                />

                {/* Band Builder - Works for all modes */}
                <GenericBandBuilder
                  bands={modeFreqBands}
                  setBands={setModeFreqBands}
                  isEditable={activeModeId === 'generic'}
                />

                {/* Requirements for Customized Modes */}
                {activeModeId !== 'generic' && activeMode.requirements && activeMode.requirements.length > 0 && (
                  <div className="requirements-box">
                    <div className="requirements-title">
                      <span>Requirements</span>
                    </div>
                    <div className="requirements-list">
                      {activeMode.requirements.map((req, idx) => (
                        <div key={idx} className="requirement-item">
                          <span className="requirement-badge">{idx + 1}</span>
                          <span className="requirement-text">{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Band Information - Works for all modes */}
                {modeFreqBands && modeFreqBands.length > 0 && (
                  <>
                    <div className="bands-info">
                      {modeFreqBands.map((b) => (
                        <div key={b.id} className="band-info-item">
                          <span className="band-info-label">{b.name}</span>
                          <span className="band-info-examples">{b.examples && `(${b.examples})`}</span>
                          {Number.isFinite(Number(b.low)) && Number.isFinite(Number(b.high)) && (
                            <span className="band-info-gain">{`${Number(b.low).toFixed(1)}-${Number(b.high).toFixed(1)} Hz`}</span>
                          )}
                          <span className="band-info-gain">{Number(b.gain).toFixed(2)}×</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!isGenericMode && processingMethod === 'wavelet' && (
                  <>
                    <div className="field" style={{ marginTop: '0.5rem' }}>
                      <span>Wavelet Basis</span>
                      <select
                        className="select"
                        value={waveletType}
                        onChange={(e) => {
                          const nextType = normalizeWaveletName(e.target.value, getModeWaveletDefault(activeModeId));
                          setWaveletType(nextType);
                          setWaveletSliders((prev) => normalizeWaveletSliders(prev, maxWaveletLevel));
                        }}
                      >
                        {WAVELET_BASIS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <p className="helper-text" style={{ marginTop: '0.35rem' }}>{recommendedWavelet}</p>

                    <h3 className="box-label" style={{ marginTop: '0.75rem' }}>Wavelet Level Gains</h3>
                    <SliderGroup
                      count={waveletLevelLabels.length}
                      labels={waveletLevelLabels}
                      values={waveletSliders}
                      onChange={(vals) => setWaveletSliders(normalizeWaveletSliders(vals, maxWaveletLevel))}
                    />

                    <div className="helper-text" style={{ marginTop: '0.6rem' }}>
                      {waveletLevelLabels.map((_, idx) => (
                        <div key={`wavelet-level-help-${idx}`}>{describeWaveletLevel(idx + 1, uploadedSampleRate)}</div>
                      ))}
                    </div>
                  </>
                )}

              </div>
              <button type="button" className="btn btn-small" style={{ marginTop: '0.5rem' }} onClick={handleLoadPreset}>Load preset</button>
            </div>
          )}
          {equalizerTab === 'ai' && (
            <>
              {activeModeId === 'ecg' ? (
                <div className="box ai-box">
                  <h2 className="box-title">ECG AI Diagnosis</h2>
                  <p className="helper-text" style={{ marginBottom: '8px' }}>
                    ResNet arrhythmia classifier · GradCAM explainability · Upload a WAV file via Mode Signals first.
                  </p>
                  <ECGAIViewer
                    signal={modeUploadedSignals['ecg'] || null}
                    sampleRate={modeUploadedSampleRates['ecg'] || 360}
                  />
                </div>
              ) : (
                <div className="box equalizer-box ai-box">
              <input
                ref={aiPresetFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleAiPresetFileSelected}
                style={{ display: 'none' }}
              />
              <div className="box-head">
                <h2 className="box-title">AI Separation Controls</h2>
                <div className="box-actions">
                  <div className="method-toggle" style={{ marginRight: '1rem', display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '4px' }}>
                    <button
                      type="button"
                      className={`btn-xs ${processingMethod === 'fft' ? 'active' : ''}`}
                      onClick={() => setProcessingMethod('fft')}
                      style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: processingMethod === 'fft' ? '#6366f1' : 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}
                    >FFT</button>
                    {!isGenericMode && (
                      <button
                        type="button"
                        className={`btn-xs ${processingMethod === 'wavelet' ? 'active' : ''}`}
                        onClick={() => setProcessingMethod('wavelet')}
                        style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: processingMethod === 'wavelet' ? '#6366f1' : 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}
                      >Wavelet</button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setAiModeFreqBands(aiModeFreqBands.map((b) => ({ ...b, gain: 1 })));
                      if (processingMethod === 'wavelet' && !isGenericMode) {
                        setWaveletSliders(buildWaveletDefaults(maxWaveletLevel));
                      }
                    }}
                    title="Reset"
                  >{'\u21BA'}</button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleAiPresetLoadClick}
                    title="Load AI preset"
                  >{'\u{1F4C2}'}</button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleSaveAiPreset}
                    title="Save AI preset"
                  >{'\u{1F4BE}'}</button>
                </div>
              </div>

              <div className="equalizer-scroll-container">
                <p className="helper-text">
                  {activeModeId === 'music'
                    ? 'Run Demucs separation, extract stem frequency ranges into AI sliders, then compare model stems against DSP isolation using FFT/Wavelet.'
                    : 'Run component separation for the current mode and inspect each isolated track.'}
                </p>

                {activeModeId === 'music' && aiModeFreqBands.length === 0 && (
                  <p className="helper-text">Run AI Separation once to extract Demucs stem ranges into the AI sliders.</p>
                )}

                {aiModeFreqBands.length > 0 && (
                  <>
                    <EqualizerCurve
                      labels={aiModeFreqBands.map((b) => b.name)}
                      values={aiModeFreqBands.map((b) => Number(b.gain) || 1)}
                      onChange={(vals) => {
                        setAiModeFreqBands(aiModeFreqBands.map((b, i) => ({ ...b, gain: vals[i] })));
                      }}
                    />

                    <GenericBandBuilder
                      bands={aiModeFreqBands}
                      setBands={setAiModeFreqBands}
                      isEditable={false}
                    />

                    <div className="bands-info">
                      {aiModeFreqBands.map((b) => (
                        <div key={b.id} className="band-info-item">
                          <span className="band-info-label">{b.name}</span>
                          <span className="band-info-gain">{`${Number(b.low || 0).toFixed(1)}-${Number(b.high || 0).toFixed(1)} Hz`}</span>
                          <span className="band-info-gain">{Number(b.gain || 1).toFixed(2)}×</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!isGenericMode && processingMethod === 'wavelet' && (
                  <>
                    <div className="field" style={{ marginTop: '0.5rem' }}>
                      <span>Wavelet Basis</span>
                      <select
                        className="select"
                        value={waveletType}
                        onChange={(e) => {
                          const nextType = normalizeWaveletName(e.target.value, getModeWaveletDefault(activeModeId));
                          setWaveletType(nextType);
                          setWaveletSliders((prev) => normalizeWaveletSliders(prev, maxWaveletLevel));
                        }}
                      >
                        {WAVELET_BASIS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <p className="helper-text" style={{ marginTop: '0.35rem' }}>{recommendedWavelet}</p>

                    <h3 className="box-label" style={{ marginTop: '0.75rem' }}>Wavelet Level Gains</h3>
                    <SliderGroup
                      count={waveletLevelLabels.length}
                      labels={waveletLevelLabels}
                      values={waveletSliders}
                      onChange={(vals) => setWaveletSliders(normalizeWaveletSliders(vals, maxWaveletLevel))}
                    />

                    <div className="helper-text" style={{ marginTop: '0.6rem' }}>
                      {waveletLevelLabels.map((_, idx) => (
                        <div key={`wavelet-level-help-ai-${idx}`}>{describeWaveletLevel(idx + 1, uploadedSampleRate)}</div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-small" onClick={runAiSeparation} disabled={aiLoading}>
                    {aiLoading ? 'Separating...' : 'AI Separation'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={runAiComparison}
                    disabled={aiLoading || aiComponents.length === 0}
                  >
                    Compare
                  </button>
                </div>

                <p className="helper-text">
                  AI sliders are independent from Equalizer sliders. Use Compare to compute AI vs DSP metrics.
                </p>

                {aiError && <p className="helper-text" style={{ color: '#fda4af' }}>{aiError}</p>}

                {!aiLoading && !aiError && aiComponents.length === 0 && (
                  <p className="helper-text">No separated components yet. Click AI Separation.</p>
                )}

                {!aiLoading && aiComponents.length > 0 && (
                  <div className="bands-info" style={{ marginTop: '0.25rem' }}>
                    {aiComponents.map((comp, idx) => (
                      <div key={comp.id} className="band-info-item" style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="band-info-label">{comp.name}</span>
                        {activeModeId === 'music' ? (
                          <>
                            <span className="band-info-gain">{`${Number(comp.low || 0).toFixed(1)}-${Number(comp.high || 0).toFixed(1)} Hz`}</span>
                            {(() => {
                              const metrics = aiComparisonView === 'static' ? comp.compareStatic : comp.compareAi;
                              return (
                                <>
                                  <span className="band-info-gain">SNR {Number.isFinite(Number(metrics?.snr)) ? `${Number(metrics.snr).toFixed(2)} dB` : '--'}</span>
                                  <span className="band-info-gain">Corr {Number.isFinite(Number(metrics?.correlation)) ? Number(metrics.correlation).toFixed(4) : '--'}</span>
                                </>
                              );
                            })()}
                            {comp.modelStemUrl && (
                              <audio
                                controls
                                preload="none"
                                src={comp.modelStemUrl}
                                style={{ width: '100%', marginTop: '0.35rem' }}
                              />
                            )}
                          </>
                        ) : (
                          <span className="band-info-gain">RMS {Number(comp.rms || 0).toFixed(4)}</span>
                        )}
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => applyAiSoloToEqualizer(idx)}
                          title="Apply this component as solo in Equalizer mode"
                        >
                          Solo In EQ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </aside>

        <main className="workspace-right">
          <div className="row two-boxes">
            <div className="box signal-box">
              <WaveformViewer
                title="Input Signal"
                data={signalData?.input_signal}
                time={signalData?.time}
                playbackTime={playbackTime}
                viewWindow={linkedViewWindow}
                amplitudeScale={sharedWaveformMax}
                variant="input"
                isPlaying={isPlaying}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                playbackRate={playbackRate}
                onSpeedChange={handleSpeedChange}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onPanLeft={handlePanLeft}
                onPanRight={handlePanRight}
                onResetView={handleResetView}
              />
            </div>
            <div className="box signal-box">
              <WaveformViewer
                title="Output Signal"
                data={signalData?.output_signal}
                time={signalData?.time}
                playbackTime={playbackTime}
                viewWindow={linkedViewWindow}
                amplitudeScale={sharedWaveformMax}
                variant="output"
                isPlaying={isPlaying}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                playbackRate={playbackRate}
                onSpeedChange={handleSpeedChange}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onPanLeft={handlePanLeft}
                onPanRight={handlePanRight}
                onResetView={handleResetView}
              />
            </div>
          </div>

          <div className="row section-row">
            <div className="section-head">
              <h2 className="section-title">Frequency Spectrum (FFT)</h2>
              <AudiogramToggle checked={audiogram} onChange={setAudiogram} />
            </div>
            <div className="row two-boxes">
              <div className="box chart-box card-with-zoom">
                <h3 className="box-label">Input FFT</h3>
                <FFTChart
                  data={signalData?.fft}
                  audiogram={audiogram}
                  variant="input"
                  zoomWindow={fftZoomWindow}
                  onZoomWindowChange={setFftZoomWindow}
                />
                <span className="card-zoom">{linkedZoom.toFixed(1)}×</span>
              </div>
              <div className="box chart-box card-with-zoom">
                <h3 className="box-label">Output FFT</h3>
                <FFTChart
                  data={signalData?.fft}
                  audiogram={audiogram}
                  variant="output"
                  zoomWindow={fftZoomWindow}
                  onZoomWindowChange={setFftZoomWindow}
                />
                <span className="card-zoom">{linkedZoom.toFixed(1)}×</span>
              </div>
            </div>
          </div>

          <div className="row section-row">
            <div className="section-head">
              <h2 className="section-title">Spectrograms</h2>
              <button type="button" className="btn btn-small" onClick={() => setShowSpec(!showSpec)}>
                {showSpec ? 'Hide' : 'Show'} spectrograms
              </button>
            </div>
            {showSpec && signalData && (
              <div className="row two-boxes">
                <div className="box chart-box">
                  <div className="section-head" style={{ marginBottom: '0.4rem' }}>
                    <h3 className="box-label">Input spectrogram</h3>
                    <select className="select" value={inputSpecColorScale} onChange={(e) => setInputSpecColorScale(e.target.value)} style={{ width: 'auto', minWidth: '130px' }}>
                      <option value="inferno">Inferno</option>
                      <option value="viridis">Viridis</option>
                      <option value="turbo">Turbo</option>
                      <option value="grayscale">Grayscale</option>
                    </select>
                  </div>
                  <SpectrogramViewer title="" times={signalData.spectrogram.t} freqs={signalData.spectrogram.f} magnitudes={signalData.spectrogram.in} normalizationMax={sharedSpectrogramMax} colorScale={inputSpecColorScale} />
                </div>
                <div className="box chart-box">
                  <div className="section-head" style={{ marginBottom: '0.4rem' }}>
                    <h3 className="box-label">Output spectrogram</h3>
                    <select className="select" value={outputSpecColorScale} onChange={(e) => setOutputSpecColorScale(e.target.value)} style={{ width: 'auto', minWidth: '130px' }}>
                      <option value="inferno">Inferno</option>
                      <option value="viridis">Viridis</option>
                      <option value="turbo">Turbo</option>
                      <option value="grayscale">Grayscale</option>
                    </select>
                  </div>
                  <SpectrogramViewer title="" times={signalData.spectrogram.t} freqs={signalData.spectrogram.f} magnitudes={signalData.spectrogram.out} normalizationMax={sharedSpectrogramMax} colorScale={outputSpecColorScale} />
                </div>
              </div>
            )}
          </div>

          {!isGenericMode && processingMethod === 'wavelet' && (
            <div className="row section-row">
              <div className="section-head">
                <h2 className="section-title">Wavelet Section ({activeWaveletBasis.label})</h2>
              </div>
              <div className="row">
                <div className="box chart-box">
                  <WaveletChart data={signalData?.wavelet} />
                </div>
              </div>
            </div>
          )}

          {equalizerTab === 'ai' && (
            <div className="row section-row">
              <div className="section-head">
                <h2 className="section-title">AI Comparison Results</h2>
                {activeModeId === 'music' && (
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`segmented-option ${aiComparisonView === 'ai' ? 'active' : ''}`}
                      onClick={() => setAiComparisonView('ai')}
                    >
                      AI Bands
                    </button>
                    <button
                      type="button"
                      className={`segmented-option ${aiComparisonView === 'static' ? 'active' : ''}`}
                      onClick={() => setAiComparisonView('static')}
                    >
                      Static Bands
                    </button>
                  </div>
                )}
              </div>

              <div className="box chart-box">
                {aiLoading && <p className="helper-text">Running AI comparison...</p>}
                {!aiLoading && aiError && <p className="helper-text" style={{ color: '#fda4af' }}>{aiError}</p>}

                {!aiLoading && !aiError && aiComponents.length === 0 && (
                  <p className="helper-text">Run AI Separation, then click Compare to generate metrics.</p>
                )}

                {!aiLoading && !aiError && aiComponents.length > 0 && activeModeId === 'music' && (
                  <div className="bands-info">
                    <div
                      className="band-info-item"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.25fr 1fr 1fr 1fr 1fr',
                        gap: '0.5rem',
                        paddingTop: 0,
                        color: 'var(--text-muted)'
                      }}
                    >
                      <span className="band-info-label">Component</span>
                      <span className="band-info-label">SNR (dB)</span>
                      <span className="band-info-label">Model RMS</span>
                      <span className="band-info-label">DSP RMS</span>
                      <span className="band-info-label">Correlation</span>
                    </div>

                    {aiComponents.map((comp) => (
                      <div
                        key={`ai-result-${comp.id}`}
                        className="band-info-item"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.25fr 1fr 1fr 1fr 1fr',
                          gap: '0.5rem',
                          alignItems: 'center'
                        }}
                      >
                        <span className="band-info-label">{comp.name}</span>
                        {(() => {
                          const metrics = aiComparisonView === 'static' ? comp.compareStatic : comp.compareAi;
                          return (
                            <>
                              <span className="band-info-gain">{Number.isFinite(Number(metrics?.snr)) ? Number(metrics.snr).toFixed(2) : '--'}</span>
                              <span className="band-info-gain">{Number.isFinite(Number(metrics?.modelRms)) ? Number(metrics.modelRms).toFixed(4) : '--'}</span>
                              <span className="band-info-gain">{Number.isFinite(Number(metrics?.dspRms)) ? Number(metrics.dspRms).toFixed(4) : '--'}</span>
                              <span className="band-info-gain">{Number.isFinite(Number(metrics?.correlation)) ? Number(metrics.correlation).toFixed(4) : '--'}</span>
                            </>
                          );
                        })()}
                      </div>
                    ))}

                    {(() => {
                      const summary = aiComparisonView === 'static'
                        ? staticBandsComparisonSummary
                        : aiBandsComparisonSummary;
                      if (!summary) return null;
                      return (
                        <div
                          className="band-info-item"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.25fr 1fr 1fr 1fr 1fr',
                            gap: '0.5rem',
                            alignItems: 'center',
                            borderTop: '1px solid var(--border-subtle)',
                            marginTop: '0.25rem',
                            paddingTop: '0.65rem'
                          }}
                        >
                          <span className="band-info-label">Average</span>
                          <span className="band-info-gain">{Number(summary.avgSNR).toFixed(2)}</span>
                          <span className="band-info-gain">{Number(summary.avgModelRms).toFixed(4)}</span>
                          <span className="band-info-gain">{Number(summary.avgDspRms).toFixed(4)}</span>
                          <span className="band-info-gain">{Number(summary.avgCorrelation).toFixed(4)}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {!aiLoading && !aiError && aiComponents.length > 0 && activeModeId !== 'music' && (
                  <div className="bands-info">
                    {aiComponents.map((comp) => (
                      <div key={`ai-result-${comp.id}`} className="band-info-item">
                        <span className="band-info-label">{comp.name}</span>
                        <span className="band-info-gain">RMS {Number(comp.rms || 0).toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;


