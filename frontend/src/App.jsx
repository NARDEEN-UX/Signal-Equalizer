import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import WaveformViewer from './components/WaveformViewer';
import EqualizerCurve from './components/EqualizerCurve';
import FFTChart from './components/FFTChart';
import SpectrogramViewer from './components/SpectrogramViewer';
import TransportControls from './components/TransportControls';
import AudiogramToggle from './components/AudiogramToggle';
import ModeModal from './components/ModeModal';
import ModeSignalUploader from './components/ModeSignalUploader';
import GenericBandBuilder from './components/GenericBandBuilder';
import BandPresetModal from './components/BandPresetModal';
import SliderGroup from './components/SliderGroup';
import ModeWaveletSliders from './components/ModeWaveletSliders';
import WaveletBandViewer from './components/WaveletBandViewer';
import ECGAIViewer, { ECGAIComparisonGraphs } from './components/ECGAIViewer';
import './App.css';
import { useBackendProcessing } from './hooks/useBackendProcessing';
import { useMockProcessing } from './mock/useMockProcessing';
import {
  API_BASE_URL,
  saveSchema,
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
  separateHumansModeAI,
  processECGMode,
  applyWaveletBandGains
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
    sliderLabels: ['drums', 'bass', 'guitar', 'piano', 'vocals', 'other'],
    allowAddSubdivision: false,
    requirements: ['Demucs drums stem', 'Demucs bass stem', 'Demucs guitar stem', 'Demucs piano stem', 'Demucs vocals stem', 'Demucs other stem']
  },
  {
    id: 'animal',
    name: 'Animal Sounds',
    tag: 'Animal mixture',
    description: 'Adjust different animal sounds with scientifically accurate frequency ranges.',
    accentClass: 'mode-animal',
    icon: '❖',
    sliderLabels: ['Frog', 'Birds', 'Dog', 'Cat'],
    allowAddSubdivision: false,
    requirements: ['Frog (1084.5-2509.3 Hz)', 'Birds (3018.2-5203.4 Hz)', 'Dog (479.6-2314.9 Hz)', 'Cat (708.0-3620.9 Hz)']
  },
  {
    id: 'human',
    name: 'Human Voices',
    tag: '2-speaker AI + DSP bands',
    description: 'Manage multiple human voices in a single recording.',
    accentClass: 'mode-human',
    icon: '⌁',
    sliderLabels: ['Children Voices (Pre-Puberty)', 'French Audio (FLEURS Dataset)', 'Spanish Audio (FLEURS Dataset)', 'female', 'male'],
    allowAddSubdivision: false,
    requirements: ['Children Voices (220-300 and 350-600 Hz)', 'French Audio suggested band (128.12-685.94 Hz)', 'Spanish Audio suggested band (128.12-1792.19 Hz)', 'female suggested band (205.96-1444.01 Hz)', 'male suggested band (112.08-1322.75 Hz)']
  },
  {
    id: 'ecg',
    name: 'ECG Abnormalities',
    tag: '4 ECG signals',
    description: 'Control magnitude of arrhythmia components (normal + 3 types).',
    accentClass: 'mode-ecg',
    icon: '♡',
    sliderLabels: ['Normal', 'AFib', 'VTach', 'HeartBlock'],
    allowAddSubdivision: false,
    requirements: ['Normal (2.2-15.5 Hz)', 'AFib (0.0-179.4 Hz)', 'VTach (2.2-3.3 Hz)', 'HeartBlock (2.2-31.0 Hz)']
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

const DEFAULT_ECG_AI_STATE = { loading: false, error: null, result: null };
const HUMAN_AI_LABELS = ['male', 'female'];

const normalizeHumanAiLabel = (name, fallbackIndex = 0) => {
  const raw = String(name || '').trim().toLowerCase();
  if (!raw) return fallbackIndex === 1 ? 'female' : 'male';
  if (raw.includes('female')) return 'female';
  if (raw.includes('male')) return 'male';
  if (raw.includes('voice 2') || raw.includes('speaker 2') || raw.includes('source 2')) return 'female';
  if (raw.includes('voice 1') || raw.includes('speaker 1') || raw.includes('source 1')) return 'male';
  return fallbackIndex === 1 ? 'female' : 'male';
};

const getHumanGenderLabel = (name) => {
  const raw = String(name || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('female') || raw.includes('even numbers')) return 'female';
  if (/\bmale\b/.test(raw) || raw.includes('odd numbers')) return 'male';
  return '';
};

const createDefaultModeUiState = () => ({
  equalizerTab: 'equalizer',
  aiComponents: [],
  aiLoading: false,
  aiError: '',
  aiNotice: '',
  aiComparisonView: 'ai',
  ecgAiState: { ...DEFAULT_ECG_AI_STATE }
});

const buildInitialModeUiState = () => {
  const initial = {};
  MODES.forEach((mode) => {
    initial[mode.id] = createDefaultModeUiState();
  });
  return initial;
};

// Default band configurations for each mode
const DEFAULT_MODE_BANDS = {
  generic: [
    { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1 },
    { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1 },
    { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1 },
    { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1 }
  ],
  music: [
    { id: 'music-0', name: 'drums', low: 20, high: 500, ranges: [[20, 200], [200, 500]], gain: 1.0 },
    { id: 'music-1', name: 'bass', low: 30, high: 300, ranges: [[30, 150], [150, 300]], gain: 1.0 },
    { id: 'music-2', name: 'guitar', low: 80, high: 1200, ranges: [[80, 600], [600, 1200]], gain: 1.0 },
    { id: 'music-3', name: 'piano', low: 28, high: 4186, ranges: [[28, 500], [500, 4186]], gain: 1.0 },
    { id: 'music-4', name: 'vocals', low: 85, high: 3400, ranges: [[85, 1000], [1000, 3400]], gain: 1.0 },
    { id: 'music-5', name: 'other', low: 200, high: 8000, ranges: [[200, 2000], [2000, 8000]], gain: 1.0 }
  ],
  animal: [
    { id: 'animal-0', name: 'Frog', low: 1084.5, high: 2509.3, gain: 1.0 },
    { id: 'animal-1', name: 'Birds', low: 3018.2, high: 5203.4, gain: 1.0 },
    { id: 'animal-2', name: 'Dog', low: 479.6, high: 2314.9, gain: 1.0 },
    { id: 'animal-3', name: 'Cat', low: 708.0, high: 3620.9, gain: 1.0 }
  ],
  human: [
    { id: 'human-0', name: 'Children Voices (Pre-Puberty)', low: 220, high: 600, ranges: [[220, 300], [350, 600]], gain: 1 },
    { id: 'human-1', name: 'French Audio (FLEURS Dataset)', low: 128.12, high: 685.94, ranges: [[128.12, 685.94]], gain: 1 },
    { id: 'human-2', name: 'Spanish Audio (FLEURS Dataset)', low: 128.12, high: 1792.19, ranges: [[128.12, 1792.19]], gain: 1 },
    { id: 'human-3', name: 'female', low: 205.96, high: 1444.01, ranges: [[205.96, 1444.01]], gain: 1 },
    { id: 'human-4', name: 'male', low: 112.08, high: 1322.75, ranges: [[112.08, 1322.75]], gain: 1 }
  ],
  ecg: [
    { id: 'ecg-0', name: 'Normal', low: 2.2, high: 15.5, gain: 1 },
    { id: 'ecg-1', name: 'AFib', low: 0.0, high: 179.4, gain: 1 },
    { id: 'ecg-2', name: 'VTach', low: 2.2, high: 3.3, gain: 1 },
    { id: 'ecg-3', name: 'HeartBlock', low: 2.2, high: 31.0, gain: 1 }
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
  music: 'db4',
  animal: 'sym8',
  animals: 'sym8',
  human: 'sym5',
  humans: 'sym5',
  ecg: 'bior3.5'
};

const WAVELET_RECOMMENDATION_BY_MODE = {
  generic: 'db4: robust general-purpose orthogonal basis for mixed content.',
  music: 'db4: balanced decomposition for musical mixtures with clear band control.',
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

const makeSignalToken = (signal) => {
  if (!Array.isArray(signal) || signal.length === 0) return 'none';
  const first = Number(signal[0]) || 0;
  const last = Number(signal[signal.length - 1]) || 0;
  return `${signal.length}:${first}:${last}`;
};

const isGenericSyntheticName = (name) => {
  const s = String(name || '').toLowerCase();
  return s.includes('generic_synth_');
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
  const MAX_UI_SIGNAL_SAMPLES = 120000;
  const MIN_PLAYBACK_SAMPLE_RATE = 3000;
  const MAX_PLAYBACK_SAMPLE_RATE = 192000;

  const [view, setView] = useState('landing'); // 'landing' | 'workspace'
  const [homeMode, setHomeMode] = useState('Home');
  const [activeModeId, setActiveModeId] = useState('generic');
  const [audiogram, setAudiogram] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [inputSpecColorScale, setInputSpecColorScale] = useState('inferno');
  const [outputSpecColorScale, setOutputSpecColorScale] = useState('inferno');
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
  const [modeSignalLoading, setModeSignalLoading] = useState({});

  // Get uploaded signal for current mode
  const uploadedSignal = modeUploadedSignals[activeModeId] || null;
  const uploadedSampleRate = modeUploadedSampleRates[activeModeId] || 44100;
  const audioFile = modeAudioFiles[activeModeId] || null;

  // Unified band configuration for all modes
  const [modeFreqConfig, setModeFreqConfig] = useState(DEFAULT_MODE_BANDS);
  const [aiModeFreqConfig, setAiModeFreqConfig] = useState({});

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
  const [modeUiState, setModeUiState] = useState(() => buildInitialModeUiState());
  // Linked viewer window (0-1 normalized signal range) shared by input and output.
  const [linkedViewWindow, setLinkedViewWindow] = useState({ start: 0, end: 1 });
  const [fftZoomWindow, setFftZoomWindow] = useState({ x: null, y: null });
  const [specZoomWindow, setSpecZoomWindow] = useState({ t0: 0, t1: 1, f0: 0, f1: 1 });

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const rafRef = useRef(null);
  const offsetTimeRef = useRef(0);
  const playbackSampleRateRef = useRef(44100);
  const playbackInputSampleRateRef = useRef(44100);
  const prevOutputSignalRef = useRef(null);
  const lastStableBackendDataByModeRef = useRef({});
  const loadedDefaultsByModeRef = useRef({});
  const autoScrollEnabledRef = useRef(true);
  const aiPresetFileInputRef = useRef(null);
  const aiStemSignalCacheRef = useRef(new Map());

  const activeMode = MODES.find((m) => m.id === activeModeId) || MODES[0];
  const isGenericMode = activeModeId === 'generic';
  const isSignalLoading = Boolean(modeSignalLoading[activeModeId]);
  const activeWaveletBasis = WAVELET_BASIS_MAP[normalizeWaveletName(waveletType, getModeWaveletDefault(activeModeId))] || WAVELET_BASIS_MAP.db4;
  const recommendedWavelet = WAVELET_RECOMMENDATION_BY_MODE[activeModeId] || WAVELET_RECOMMENDATION_BY_MODE.generic;

  const activeModeUiState = modeUiState[activeModeId] || createDefaultModeUiState();
  const equalizerTab = activeModeUiState.equalizerTab;
  const waveletTabActive = !isGenericMode && equalizerTab === 'wavelet';
  const aiComponents = Array.isArray(activeModeUiState.aiComponents) ? activeModeUiState.aiComponents : [];
  const aiLoading = Boolean(activeModeUiState.aiLoading);
  const aiError = String(activeModeUiState.aiError || '');
  const aiNotice = String(activeModeUiState.aiNotice || '');
  const aiComparisonView = activeModeUiState.aiComparisonView === 'static' ? 'static' : 'ai';
  const ecgAiState = activeModeUiState.ecgAiState || DEFAULT_ECG_AI_STATE;

  const updateModeUiState = (modeId, updater) => {
    setModeUiState((prev) => {
      const current = prev[modeId] || createDefaultModeUiState();
      const nextValue = typeof updater === 'function' ? updater(current) : updater;
      const next = { ...current, ...(nextValue || {}) };
      return { ...prev, [modeId]: next };
    });
  };

  const updateActiveModeUiState = (updater) => {
    updateModeUiState(activeModeId, updater);
  };

  const setEqualizerTab = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      equalizerTab: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.equalizerTab) : valueOrUpdater
    }));
  };

  const setAiComponents = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      aiComponents: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.aiComponents) : valueOrUpdater
    }));
  };

  const setAiLoading = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      aiLoading: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.aiLoading) : valueOrUpdater
    }));
  };

  const setAiError = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      aiError: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.aiError) : valueOrUpdater
    }));
  };

  const setAiNotice = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      aiNotice: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.aiNotice) : valueOrUpdater
    }));
  };

  const setAiComparisonView = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      aiComparisonView: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.aiComparisonView) : valueOrUpdater
    }));
  };

  const setEcgAiState = (valueOrUpdater) => {
    updateActiveModeUiState((prev) => ({
      ecgAiState: typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.ecgAiState || DEFAULT_ECG_AI_STATE) : valueOrUpdater
    }));
  };

  // Get frequency bands for current mode
  const modeFreqBands = modeFreqConfig[activeModeId] ?? DEFAULT_MODE_BANDS[activeModeId] ?? [];
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
    updateModeUiState(modeId, () => ({
      aiLoading: false,
      aiError: '',
      aiNotice: '',
      aiComponents: [],
      ecgAiState: modeId === 'ecg' ? { ...DEFAULT_ECG_AI_STATE } : undefined
    }));
    aiStemSignalCacheRef.current = new Map();
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

  // Keep preview effects immediate while backend requests can lag slightly behind.
  const deferredProcessingBands = useDeferredValue(activeProcessingBands);
  const deferredWaveletSliders = useDeferredValue(waveletSliders);

  const safeGain = (value, fallback = 1) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const mockSignalData = useMockProcessing({
    modeId: activeModeId,
    freqSliders: activeProcessingBands.map((b) => safeGain(b.gain, 1)),
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

  const { data: backendSignalData, loading: backendProcessingLoading, error: backendProcessingError } = useBackendProcessing({
    modeId: activeModeId,
    freqSliders: deferredProcessingBands.map((b) => safeGain(b.gain, 1)),
    genericBands: deferredProcessingBands,
    waveletType,
    waveletLevel,
    sampleRate: uploadedSampleRate,
    signalData: uploadedSignal || null,
    useFallback: true,
    processingMethod: waveletTabActive ? 'wavelet' : processingMethod,
    waveletSliders: deferredWaveletSliders
  });

  useEffect(() => {
    if (waveletTabActive && processingMethod !== 'wavelet') {
      setProcessingMethod('wavelet');
    }
  }, [waveletTabActive, processingMethod]);

  useEffect(() => {
    if (!isGenericMode && equalizerTab === 'equalizer' && processingMethod !== 'fft') {
      setProcessingMethod('fft');
    }
  }, [equalizerTab, isGenericMode, processingMethod]);

  useEffect(() => {
    if (!isGenericMode && equalizerTab === 'ai' && processingMethod !== 'fft') {
      setProcessingMethod('fft');
    }
  }, [equalizerTab, isGenericMode, processingMethod]);

  useEffect(() => {
    if (uploadedSignal && backendSignalData) {
      const token = makeSignalToken(uploadedSignal);
      lastStableBackendDataByModeRef.current = {
        ...lastStableBackendDataByModeRef.current,
        [activeModeId]: {
          token,
          data: backendSignalData
        }
      };
    }
  }, [uploadedSignal, backendSignalData, activeModeId]);

  useEffect(() => {
    if (!uploadedSignal) {
      const next = { ...lastStableBackendDataByModeRef.current };
      delete next[activeModeId];
      lastStableBackendDataByModeRef.current = next;
    }
  }, [uploadedSignal, activeModeId]);

  const passthroughSignalData = useMemo(() => {
    if (!uploadedSignal) return null;
    return {
      ...(mockSignalData || {}),
      input_signal: uploadedSignal,
      output_signal: uploadedSignal
    };
  }, [uploadedSignal, mockSignalData]);

  // Prefer backend processing when a real uploaded signal exists.
  const signalData = useMemo(() => {
    const signalToken = makeSignalToken(uploadedSignal);
    const modeStableEntry = lastStableBackendDataByModeRef.current[activeModeId] || null;
    const modeStableBackendData = modeStableEntry && modeStableEntry.token === signalToken
      ? modeStableEntry.data
      : null;

    // During file transition, hide old visuals until new processed payload is ready.
    if (isSignalLoading && !backendSignalData) {
      return null;
    }

    if (!uploadedSignal) return mockSignalData;

    if (backendSignalData) return backendSignalData;

    // During backend latency, keep last valid backend output to avoid visual/audio artifacts.
    if (backendProcessingLoading && modeStableBackendData) {
      return modeStableBackendData;
    }

    // Initial backend run or backend unavailable: show clean passthrough, not fake transformed signal.
    if (passthroughSignalData) return passthroughSignalData;

    return mockSignalData;
  }, [uploadedSignal, backendSignalData, backendProcessingLoading, passthroughSignalData, mockSignalData, activeModeId, isSignalLoading]);

  // Keep wavelet level/band graphs in sync with slider moves even if backend responses are delayed.
  const waveletVisualData = useMemo(() => {
    const wavelet = signalData?.wavelet;
    if (!wavelet || !Array.isArray(wavelet.input_coeffs) || wavelet.input_coeffs.length === 0) {
      return wavelet;
    }

    const inputCoeffs = wavelet.input_coeffs;
    const safeSliders = normalizeWaveletSliders(waveletSliders, inputCoeffs.length);

    const outputCoeffsPreview = inputCoeffs.map((coeff, idx) => {
      const gain = Math.max(0, Math.min(2, safeGain(safeSliders[idx], 1)));
      const arr = Array.isArray(coeff) ? coeff : [];
      return arr.map((v) => (Number(v) || 0) * gain);
    });

    return {
      ...wavelet,
      output_coeffs: outputCoeffsPreview,
      levels: Array.isArray(wavelet.levels) && wavelet.levels.length > 0
        ? wavelet.levels
        : Array.from({ length: inputCoeffs.length }, (_, i) => `L${i + 1}`)
    };
  }, [signalData?.wavelet, waveletSliders]);

  useEffect(() => {
    if (!isSignalLoading) return;
    if (backendSignalData || backendProcessingError) {
      setModeSignalLoading((prev) => ({ ...prev, [activeModeId]: false }));
    }
  }, [isSignalLoading, backendSignalData, backendProcessingError, activeModeId]);

  useEffect(() => {
    setSpecZoomWindow({ t0: 0, t1: 1, f0: 0, f1: 1 });
  }, [activeModeId, uploadedSignal]);

  const sharedSpectrogramMax = useMemo(() => {
    const specIn = signalData?.spectrogram?.in;
    if (!specIn) return null;
    let maxVal = -Infinity;

    const scan = (matrix) => {
      if (!Array.isArray(matrix)) return;
      for (let r = 0; r < matrix.length; r += 1) {
        const row = matrix[r];
        if (Array.isArray(row)) {
          for (let c = 0; c < row.length; c += 1) {
            const v = Number(row[c]);
            if (Number.isFinite(v) && v > maxVal) maxVal = v;
          }
        } else {
          const v = Number(row);
          if (Number.isFinite(v) && v > maxVal) maxVal = v;
        }
      }
    };

    scan(specIn);

    if (!Number.isFinite(maxVal)) {
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

  const decodeAudioArrayBuffer = async (arrayBuffer) => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const channel = decoded.getChannelData(0);
      return Array.from(channel, (v) => Number(v) || 0);
    } finally {
      await audioCtx.close();
    }
  };

  const loadModelSignalFromStemUrl = async (stemUrl) => {
    const url = String(stemUrl || '').trim();
    if (!url) return [];

    const cached = aiStemSignalCacheRef.current.get(url);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load AI stem (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const signal = await decodeAudioArrayBuffer(arrayBuffer);
    aiStemSignalCacheRef.current.set(url, signal);
    return signal;
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
    setAiNotice('');

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

      if (activeModeId === 'human') {
        const aiResponse = await separateHumansModeAI(inputSignal, ['Male', 'Female'], srInt, 'speechbrain/sepformer-wsj02mix');
        const rawComponents = Array.isArray(aiResponse?.data?.components) ? aiResponse.data.components : [];
        if (!rawComponents.length) {
          throw new Error('AI voice separation returned no components for this file.');
        }

        const warning = String(aiResponse?.data?.warning || '');
        if (warning) {
          setAiNotice(warning);
        }

        const previousBands = Array.isArray(aiModeFreqBands) && aiModeFreqBands.length
          ? aiModeFreqBands
          : modeFreqBands;
        const gainByName = (Array.isArray(previousBands) ? previousBands : []).reduce((acc, band) => {
          const key = String(band?.name || '').toLowerCase();
          acc[key] = Number(band?.gain) || 1;
          if (key.includes('female')) acc.female = acc[key];
          if (/\bmale\b/.test(key) || key.includes('odd numbers')) acc.male = acc[key];
          return acc;
        }, {});

        const humanAiByLabel = {};
        rawComponents.forEach((comp, idx) => {
          const normalizedLabel = normalizeHumanAiLabel(comp?.name, idx);
          if (!humanAiByLabel[normalizedLabel]) {
            humanAiByLabel[normalizedLabel] = comp;
          }
        });

        const orderedAiComponents = HUMAN_AI_LABELS.map((label, idx) => {
          const comp = humanAiByLabel[label] || rawComponents[idx] || null;
          return { label, comp };
        });

        const autoBands = orderedAiComponents.map(({ label, comp }, idx) => {
          const low = Math.max(0, Number(comp?.low) || (label === 'male' ? 112.08 : 205.96));
          const high = Math.max(low + 1, Number(comp?.high) || (label === 'male' ? 1322.75 : 1444.01));
          return {
            id: `human-${idx}`,
            name: label,
            low,
            high,
            gain: Number.isFinite(gainByName[label]) ? gainByName[label] : 1
          };
        });
        setAiModeFreqConfig((prev) => ({ ...prev, human: autoBands }));

        const extracted = autoBands.map((band, idx) => {
          const modelComp = orderedAiComponents[idx]?.comp || {};
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
    const isMusic = activeModeId === 'music';
    const isHuman = activeModeId === 'human';
    if (!isMusic && !isHuman) {
      setAiError('AI comparison is only available for Music and Human modes.');
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
        if (isHuman) {
          return processHumansMode(
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
        }
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
        if (isHuman) {
          return processHumansMode(
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
        }
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

      const resolvedModelSignals = await Promise.all(
        aiComponents.map(async (comp) => {
          const existing = Array.isArray(comp?.modelSignal) ? comp.modelSignal : [];
          if (existing.length > 0) return existing;

          const stemUrl = String(comp?.modelStemUrl || '');
          if (!stemUrl) return [];

          try {
            return await loadModelSignalFromStemUrl(stemUrl);
          } catch (stemErr) {
            console.warn('Could not decode AI stem for comparison:', stemErr);
            return [];
          }
        })
      );

      const updated = aiComponents.map((comp, idx) => {
        const modelSignal = Array.isArray(resolvedModelSignals[idx]) ? resolvedModelSignals[idx] : [];
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
          modelSignal,
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
    const selectedHumanGender = activeModeId === 'human'
      ? (getHumanGenderLabel(selectedName) || normalizeHumanAiLabel(selectedName, componentIndex))
      : '';
    setModeFreqBands(modeFreqBands.map((b, i) => {
      if (activeModeId === 'human' && selectedHumanGender) {
        const bandGender = getHumanGenderLabel(b?.name);
        return { ...b, gain: bandGender === selectedHumanGender ? 1 : 0 };
      }

      const byNameMatch = selectedName && String(b?.name || '').toLowerCase() === selectedName;
      const byIndexMatch = i === componentIndex;
      return { ...b, gain: (byNameMatch || (!selectedName && byIndexMatch)) ? 1 : 0 };
    }));
    setEqualizerTab('equalizer');
  };

  const aiBandsComparisonSummary = useMemo(() => {
    if ((activeModeId !== 'music' && activeModeId !== 'human') || !Array.isArray(aiComponents) || aiComponents.length === 0) {
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
    if ((activeModeId !== 'music' && activeModeId !== 'human') || !Array.isArray(aiComponents) || aiComponents.length === 0) {
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
      setEqualizerTab('equalizer');
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
    resetPlayback();
  }, [activeModeId]);

  useEffect(() => {
    const loadDefaults = async () => {
      if (loadedDefaultsByModeRef.current[activeModeId]) {
        return;
      }

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
              const selectedWavelet = getModeWaveletDefault('music');
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
              const selectedWavelet = getModeWaveletDefault('animal');
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
              const selectedWavelet = getModeWaveletDefault('human');
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
              const selectedWavelet = getModeWaveletDefault('ecg');
              setWaveletType(selectedWavelet);
              setWaveletSliders(normalizeWaveletSliders(response.data?.sliders_wavelet, maxWaveletLevel));
            }
            break;
          default:
            break;
        }
        loadedDefaultsByModeRef.current = {
          ...loadedDefaultsByModeRef.current,
          [activeModeId]: true
        };
      } catch (error) {
        console.log('Could not load default settings from backend:', error);
        // Silently fail - use whatever defaults are set
      }
    };

    loadDefaults();
  }, [activeModeId]);

  const stopAudio = () => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
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

  const estimateSampleRateFromTime = (timeAxis) => {
    if (!Array.isArray(timeAxis) || timeAxis.length < 2) return 44100;
    const diffs = [];
    const limit = Math.min(timeAxis.length, 2000);
    for (let i = 1; i < limit; i += 1) {
      const d = Number(timeAxis[i]) - Number(timeAxis[i - 1]);
      if (Number.isFinite(d) && d > 0) diffs.push(d);
    }
    if (!diffs.length) return 44100;
    diffs.sort((a, b) => a - b);
    const median = diffs[Math.floor(diffs.length / 2)] || (1 / 44100);
    return 1 / Math.max(1e-9, median);
  };

  const buildPlaybackBuffer = (ctx, signal, desiredSampleRate) => {
    const src = Array.isArray(signal) ? signal : [];
    if (!src.length) return null;

    const safeDesired = Math.max(1, Number(desiredSampleRate) || 44100);
    const playbackSampleRate = Math.max(
      MIN_PLAYBACK_SAMPLE_RATE,
      Math.min(MAX_PLAYBACK_SAMPLE_RATE, Math.round(safeDesired) || 44100)
    );

    playbackInputSampleRateRef.current = safeDesired;
    playbackSampleRateRef.current = playbackSampleRate;

    const ratio = playbackSampleRate / safeDesired;
    const targetLength = Math.max(1, Math.round(src.length * ratio));

    const buffer = ctx.createBuffer(1, targetLength, playbackSampleRate);
    const out = buffer.getChannelData(0);

    if (targetLength === src.length) {
      for (let i = 0; i < targetLength; i += 1) {
        out[i] = Number(src[i]) || 0;
      }
      return buffer;
    }

    const denom = Math.max(1, targetLength - 1);
    const srcLast = Math.max(0, src.length - 1);
    for (let i = 0; i < targetLength; i += 1) {
      const srcPos = (i / denom) * srcLast;
      const i0 = Math.floor(srcPos);
      const i1 = Math.min(srcLast, i0 + 1);
      const t = srcPos - i0;
      const v0 = Number(src[i0]) || 0;
      const v1 = Number(src[i1]) || 0;
      out[i] = v0 + (v1 - v0) * t;
    }

    return buffer;
  };

  const handlePlay = (startFrom = null) => {
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

    const desiredSampleRate = estimateSampleRateFromTime(signalData.time);

    let buffer;
    try {
      buffer = buildPlaybackBuffer(ctx, signalData.output_signal, desiredSampleRate);
      if (!buffer) return;
    } catch (error) {
      console.error('Failed to create playback buffer:', error);
      window.alert('Playback failed for this file. Try reloading or using a shorter file.');
      return;
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
    const resumeAt = Number.isFinite(Number(startFrom)) ? Number(startFrom) : playbackTime;
    if (resumeAt > 0 && signalData.time) {
      // Find the closest time index in the signal
      let offsetIndex = 0;
      for (let i = 0; i < signalData.time.length; i++) {
        if (signalData.time[i] >= resumeAt) {
          offsetIndex = i;
          break;
        }
      }
      offsetTime = signalData.time[offsetIndex] || resumeAt;
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
      const pausedAt = Math.min(offsetTimeRef.current + elapsed, durationRef.current);
      setPlaybackTime(pausedAt);
      offsetTimeRef.current = pausedAt;
    }

    // Stop the audio source
    if (sourceRef.current) {
      sourceRef.current.onended = null;
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
    let stoppedAt = playbackTime;
    if (audioCtxRef.current && sourceRef.current) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
      stoppedAt = Math.min(offsetTimeRef.current + elapsed, durationRef.current);
    }

    stopAudio();
    setIsPlaying(false);
    const safeStoppedAt = Number.isFinite(stoppedAt) ? Math.max(0, stoppedAt) : 0;
    setPlaybackTime(safeStoppedAt);
    offsetTimeRef.current = safeStoppedAt;
  };

  const resetPlayback = () => {
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
    const desiredSr = playbackInputSampleRateRef.current || estimateSampleRateFromTime(signalData?.time);
    let buffer;
    try {
      buffer = buildPlaybackBuffer(ctx, newSignal, desiredSr);
      if (!buffer) return;
    } catch { return; }

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

    const wasPlaying = isPlaying;
    if (wasPlaying) {
      stopAudio();
      setIsPlaying(false);
    }

    setPlaybackTime(0);
    offsetTimeRef.current = 0;

    if (wasPlaying) {
      // Restart from absolute beginning after state/ref reset.
      requestAnimationFrame(() => handlePlay(0));
    }
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
    const modeId = activeModeId;
    // Reset transport to avoid stale offsets from previous files.
    resetPlayback();
    // Reset AI Separation state for the current mode whenever a new signal is loaded.
    resetAiSeparationState(modeId);
    // Start with FFT for quick first render after opening a file.
    setProcessingMethod('fft');

    setModeSignalLoading((prev) => ({ ...prev, [modeId]: true }));
    setModeUploadedSignals((prev) => ({ ...prev, [modeId]: null }));
    setModeUploadedSampleRates((prev) => ({ ...prev, [modeId]: Number(sampleRate) || 44100 }));
    const nextStable = { ...lastStableBackendDataByModeRef.current };
    delete nextStable[modeId];
    lastStableBackendDataByModeRef.current = nextStable;

    const normalized = normalizeUploadedSignal(signal, sampleRate);

    // Synthetic generic signals are mainly used for waveform audition/comparison.
    // Force neutral EQ so output playback reflects the generated waveform itself.
    if (modeId === 'generic' && isGenericSyntheticName(filename)) {
      setModeFreqConfig((prev) => {
        const current = Array.isArray(prev.generic) ? prev.generic : [];
        if (!current.length) return prev;
        return {
          ...prev,
          generic: current.map((b) => ({ ...b, gain: 1 }))
        };
      });
    }

    // Auto-focus any synthetic generic waveform in time-domain view.
    if (modeId === 'generic' && isGenericSyntheticName(filename)) {
      const durationSec = normalized.signal.length / Math.max(1, normalized.sampleRate);
      const windowSec = 0.02; // 20 ms shows multiple cycles around 440 Hz clearly
      const end = durationSec > 0 ? Math.min(1, windowSec / durationSec) : 1;
      setLinkedViewWindow({ start: 0, end: Math.max(0.01, end) });
    } else {
      setLinkedViewWindow({ start: 0, end: 1 });
    }

    // Store the actual uploaded signal data for current mode
    setModeUploadedSignals(prev => ({
      ...prev,
      [modeId]: normalized.signal
    }));
    setModeUploadedSampleRates(prev => ({
      ...prev,
      [modeId]: normalized.sampleRate
    }));
    // Also update the audioFile name for display (per mode)
    setModeAudioFiles(prev => ({
      ...prev,
      [modeId]: {
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
    const modeId = activeModeId;
    // Reset transport so the new file always starts from t=0.
    resetPlayback();
    // Reset AI Separation state for the current mode whenever a new signal is loaded.
    resetAiSeparationState(modeId);
    // Start with FFT for quick first render after opening a file.
    setProcessingMethod('fft');

    setModeSignalLoading((prev) => ({ ...prev, [modeId]: true }));
    setModeUploadedSignals((prev) => ({ ...prev, [modeId]: null }));
    const nextStable = { ...lastStableBackendDataByModeRef.current };
    delete nextStable[modeId];
    lastStableBackendDataByModeRef.current = nextStable;

    // Always show selected file name immediately.
    setModeAudioFiles(prev => ({
      ...prev,
      [modeId]: file
    }));

    try {
      // Decode locally first so selecting a file updates the UI immediately.
      const decoded = await decodeAudioFile(file);
      setModeUploadedSignals(prev => ({
        ...prev,
        [modeId]: decoded.signal
      }));
      setModeUploadedSampleRates(prev => ({
        ...prev,
        [modeId]: decoded.sampleRate || 44100
      }));

      // Keep backend upload in background for compatibility/metadata without blocking UI.
      uploadAudio(file).catch((uploadError) => {
        console.warn('Background upload failed after local load:', uploadError);
      });
    } catch (error) {
      // Fallback path: if browser decode fails, try backend decode.
      try {
        const response = await uploadAudio(file);
        const backendSignal = response?.data?.signal;
        const backendSampleRate = response?.data?.audio?.sample_rate;

        if (Array.isArray(backendSignal) && backendSignal.length > 0) {
          const normalized = normalizeUploadedSignal(backendSignal, backendSampleRate);
          setModeUploadedSignals(prev => ({
            ...prev,
            [modeId]: normalized.signal
          }));
          setModeUploadedSampleRates(prev => ({
            ...prev,
            [modeId]: normalized.sampleRate
          }));
          return;
        }

        throw new Error('Backend did not return decodable signal data');
      } catch (backendError) {
        console.error('Could not load selected audio file:', backendError);
        setModeSignalLoading((prev) => ({ ...prev, [modeId]: false }));
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
          className={`workspace-tab ${(equalizerTab === 'equalizer' || isGenericMode) ? 'active' : ''}`}
          onClick={() => setEqualizerTab('equalizer')}
        >
          Equalizer Mode
        </button>
        {!isGenericMode && (
          <>
            <button
              type="button"
              className={`workspace-tab ${equalizerTab === 'wavelet' ? 'active' : ''}`}
              onClick={() => setEqualizerTab('wavelet')}
            >
              Wavelet
            </button>
            <button
              type="button"
              className={`workspace-tab ${equalizerTab === 'ai' ? 'active' : ''}`}
              onClick={() => setEqualizerTab('ai')}
            >
              AI Separation
            </button>
          </>
        )}
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
          {(equalizerTab === 'equalizer' || isGenericMode) && (
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
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setModeFreqBands(modeFreqBands.map((b) => ({ ...b, gain: 1 })));
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

              </div>
            </div>
          )}
          {equalizerTab === 'wavelet' && !isGenericMode && (
            <div className="box wavelet-box">
              <div className="box-head">
                <h2 className="box-title">Wavelet Band Equalizer</h2>
                <div className="box-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setWaveletSliders(buildWaveletDefaults(maxWaveletLevel));
                    }}
                    title="Reset"
                  >↺</button>
                </div>
              </div>
              <div className="equalizer-scroll-container">
                <div className="field" style={{ marginBottom: '0.5rem' }}>
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

                <p className="helper-text" style={{ marginBottom: '0.55rem' }}>{recommendedWavelet}</p>

                <ModeWaveletSliders
                  currentMode={activeModeId}
                  selectedWavelet={waveletType}
                  waveletSliders={waveletSliders}
                  maxWaveletLevel={maxWaveletLevel}
                  sampleRate={uploadedSampleRate || 44100}
                  onChange={(updatedSliders) => {
                    setWaveletSliders(normalizeWaveletSliders(updatedSliders, maxWaveletLevel));
                  }}
                />
              </div>
            </div>
          )}
          {equalizerTab === 'ai' && !isGenericMode && (
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
                    onStateChange={setEcgAiState}
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
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setAiModeFreqBands(aiModeFreqBands.map((b) => ({ ...b, gain: 1 })));
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
                    ? 'Run Demucs separation, extract stem frequency ranges into AI sliders, then compare model stems against DSP isolation using FFT.'
                    : activeModeId === 'human'
                      ? 'Run SepFormer 2-speaker separation (Male/Female), then compare model stems against DSP isolation.'
                      : 'Run component separation for the current mode and inspect each isolated track.'}
                </p>

                {(activeModeId === 'music' || activeModeId === 'human') && aiModeFreqBands.length === 0 && (
                  <p className="helper-text">
                    {activeModeId === 'music'
                      ? 'Run AI Separation once to extract Demucs stem ranges into the AI sliders.'
                      : 'Run AI Separation once to extract voice ranges into the AI sliders.'}
                  </p>
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
                {aiNotice && <p className="helper-text">{aiNotice}</p>}

                {!aiLoading && !aiError && aiComponents.length === 0 && (
                  <p className="helper-text">No separated components yet. Click AI Separation.</p>
                )}

                {!aiLoading && aiComponents.length > 0 && (
                  <div className="bands-info" style={{ marginTop: '0.25rem' }}>
                    {aiComponents.map((comp, idx) => (
                      <div key={comp.id} className="band-info-item" style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="band-info-label">{comp.name}</span>
                        {(activeModeId === 'music' || activeModeId === 'human') ? (
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
                          disabled={activeModeId === 'human' && !['male', 'female'].includes(String(comp?.name || '').toLowerCase())}
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
          {isSignalLoading && !signalData && (
            <div className="box" style={{ marginBottom: '0.8rem' }}>
              <p className="helper-text">Processing audio... preparing waveform, FFT, and spectrogram for the new file.</p>
            </div>
          )}

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

          {equalizerTab !== 'wavelet' && (
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
          )}

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
                  <SpectrogramViewer
                    title=""
                    times={signalData.spectrogram.t}
                    freqs={signalData.spectrogram.f}
                    magnitudes={signalData.spectrogram.in}
                    normalizationMax={sharedSpectrogramMax}
                    colorScale={inputSpecColorScale}
                    viewWindow={specZoomWindow}
                    onViewWindowChange={setSpecZoomWindow}
                  />
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
                  <SpectrogramViewer
                    title=""
                    times={signalData.spectrogram.t}
                    freqs={signalData.spectrogram.f}
                    magnitudes={signalData.spectrogram.out}
                    normalizationMax={sharedSpectrogramMax}
                    colorScale={outputSpecColorScale}
                    viewWindow={specZoomWindow}
                    onViewWindowChange={setSpecZoomWindow}
                  />
                </div>
              </div>
            )}
          </div>

          {equalizerTab === 'wavelet' && !isGenericMode && signalData && (
            <div className="row section-row">
              <div className="section-head">
                <h2 className="section-title">Band Waveforms</h2>
              </div>
              <div className="row">
                <div className="box chart-box" style={{ width: '100%' }}>
                  <WaveletBandViewer
                    currentMode={activeModeId}
                    inputSignal={signalData.input_signal}
                    outputSignal={signalData.output_signal}
                    waveletBandData={signalData?.wavelet?.band_waveforms}
                    waveletData={waveletVisualData}
                    selectedWavelet={waveletType}
                    waveletSliders={waveletSliders}
                    sampleRate={uploadedSampleRate || 44100}
                    maxLevel={maxWaveletLevel}
                  />
                </div>
              </div>
            </div>
          )}

          {equalizerTab === 'ai' && (
            <div className="row section-row">
              <div className="section-head">
                <h2 className="section-title">AI Output Graphs</h2>
                {(activeModeId === 'music' || activeModeId === 'human') && (
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

              {activeModeId === 'ecg' ? (
                <div style={{ width: '100%' }}>
                  {ecgAiState.loading && (
                    <p className="helper-text">Running ECG AI diagnosis...</p>
                  )}

                  {!ecgAiState.loading && ecgAiState.error && (
                    <p className="helper-text" style={{ color: '#fda4af' }}>{ecgAiState.error}</p>
                  )}

                  {!ecgAiState.loading && !ecgAiState.error && !ecgAiState.result && (
                    <p className="helper-text">Run AI Diagnosis from ECG AI Diagnosis to show explainability graphs here.</p>
                  )}

                  {!ecgAiState.loading && !ecgAiState.error && ecgAiState.result && (
                    <ECGAIComparisonGraphs
                      result={ecgAiState.result}
                      signal={modeUploadedSignals['ecg'] || null}
                      sampleRate={modeUploadedSampleRates['ecg'] || 360}
                    />
                  )}
                </div>
              ) : (
                <div className="box chart-box">
                  {aiLoading && <p className="helper-text">Running AI comparison...</p>}
                  {!aiLoading && aiError && <p className="helper-text" style={{ color: '#fda4af' }}>{aiError}</p>}

                  {!aiLoading && !aiError && aiComponents.length === 0 && (
                    <p className="helper-text">Run AI Separation, then click Compare to generate metrics.</p>
                  )}

                  {!aiLoading && !aiError && aiComponents.length > 0 && (activeModeId === 'music' || activeModeId === 'human') && (
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
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
