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
import './App.css';
import { useBackendProcessing } from './hooks/useBackendProcessing';
import { useMockProcessing } from './mock/useMockProcessing';
import {
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
    description: 'Control individual instruments inside a musical mix.',
    accentClass: 'mode-music',
    icon: '♫',
    sliderLabels: ['Bass', 'Piano', 'Vocals', 'Violin', 'Others'],
    allowAddSubdivision: false,
    requirements: ['Bass instrument', 'Piano', 'Vocal tracks', 'Violin', 'Other sounds']
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
  { id: 'music', title: 'Musical Instruments', desc: 'Isolate drums, piano, etc.' },
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
    { id: 'music-0', name: 'Bass', low: 20, high: 250, gain: 1.0 },
    { id: 'music-1', name: 'Piano', low: 27, high: 4186, gain: 1.0 },
    { id: 'music-2', name: 'Vocals', low: 80, high: 8000, gain: 1.0 },
    { id: 'music-3', name: 'Violin', low: 196, high: 3520, gain: 1.0 },
    { id: 'music-4', name: 'Others', low: 20, high: 20000, gain: 1.0 }
  ],
  animal: [
    { id: 'animal-0', name: 'Songbirds', low: 1000, high: 8000, gain: 1.0, examples: 'Sparrow, Canary, Warbler, Finch' },
    { id: 'animal-1', name: 'Canines', low: 150, high: 2000, gain: 1.0, examples: 'Dog, Wolf, Hyena, Fox' },
    { id: 'animal-2', name: 'Felines', low: 48, high: 10000, gain: 1.0, examples: 'Cat, Lion, Tiger, Leopard' },
    { id: 'animal-3', name: 'Large Mammals', low: 5, high: 500, gain: 1.0, examples: 'Elephant, Whale, Horse, Cattle' },
    { id: 'animal-4', name: 'Insects', low: 600, high: 20000, gain: 1.0, examples: 'Cricket, Cicada, Bee, Grasshopper' }
  ],
  human: [
    { id: 'human-0', name: 'Voice 1', low: 80, high: 8000, gain: 1 },
    { id: 'human-1', name: 'Voice 2', low: 80, high: 8000, gain: 1 },
    { id: 'human-2', name: 'Voice 3', low: 80, high: 8000, gain: 1 },
    { id: 'human-3', name: 'Voice 4', low: 80, high: 8000, gain: 1 }
  ],
  ecg: [
    { id: 'ecg-0', name: 'Normal Sinus', low: 0.5, high: 3, gain: 1 },
    { id: 'ecg-1', name: 'Atrial Fibrillation', low: 5, high: 50, gain: 1 },
    { id: 'ecg-2', name: 'Ventricular Tachycardia', low: 3, high: 5, gain: 1 },
    { id: 'ecg-3', name: 'Heart Block', low: 0.05, high: 0.5, gain: 1 }
  ]
};

const WAVELET_BASIS_OPTIONS = [
  { value: 'haar', label: 'Haar', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'db4', label: 'Daubechies 4 (db4)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'db6', label: 'Daubechies 6 (db6)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'db8', label: 'Daubechies 8 (db8)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'sym5', label: 'Symlet 5 (sym5)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'sym8', label: 'Symlet 8 (sym8)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'coif3', label: 'Coiflet 3 (coif3)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'bior3.5', label: 'Biorthogonal 3.5 (bior3.5)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] },
  { value: 'dmey', label: 'Discrete Meyer (dmey)', sliderLabels: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] }
];

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

const buildWaveletDefaults = (waveletName) => {
  const key = normalizeWaveletName(waveletName, 'db4');
  const labels = WAVELET_BASIS_MAP[key]?.sliderLabels || WAVELET_BASIS_MAP.db4.sliderLabels;
  return Array.from({ length: labels.length }, () => 1);
};

const normalizeWaveletSliders = (waveletName, sliders) => {
  const defaults = buildWaveletDefaults(waveletName);
  if (!Array.isArray(sliders) || sliders.length === 0) return defaults;

  return defaults.map((d, i) => {
    const n = Number(sliders[i]);
    return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : d;
  });
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
      initial[mode.id] = buildWaveletDefaults(getModeWaveletDefault(mode.id));
    });
    return initial;
  });

  // Derived values for current mode
  const waveletType = modeWaveletTypes[activeModeId] || getModeWaveletDefault(activeModeId);
  const waveletSliders = modeWaveletSliders[activeModeId] || buildWaveletDefaults(getModeWaveletDefault(activeModeId));

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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
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

  const activeMode = MODES.find((m) => m.id === activeModeId) || MODES[0];
  const activeWaveletBasis = WAVELET_BASIS_MAP[normalizeWaveletName(waveletType, getModeWaveletDefault(activeModeId))] || WAVELET_BASIS_MAP.db4;
  const recommendedWavelet = WAVELET_RECOMMENDATION_BY_MODE[activeModeId] || WAVELET_RECOMMENDATION_BY_MODE.generic;

  // Get frequency bands for current mode
  const modeFreqBands = modeFreqConfig[activeModeId] || DEFAULT_MODE_BANDS[activeModeId] || [];

  // Update frequency bands for current mode
  const setModeFreqBands = (bands) => {
    setModeFreqConfig(prev => ({
      ...prev,
      [activeModeId]: bands
    }));
  };

  const mockSignalData = useMockProcessing({
    modeId: activeModeId,
    freqSliders: modeFreqBands.map(b => Number(b.gain) || 1),
    waveletSliders,
    genericBands: modeFreqBands,
    waveletType,
    inputSignal: uploadedSignal,
    sampleRate: uploadedSampleRate
  });

  const { data: backendSignalData } = useBackendProcessing({
    modeId: activeModeId,
    freqSliders: modeFreqBands.map(b => Number(b.gain) || 1),
    genericBands: modeFreqBands,
    waveletType,
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

    // During backend processing after upload, keep output equal to input
    // so users do not see a temporary mock-processed mismatch.
    if (!mockSignalData) return null;
    return {
      ...mockSignalData,
      output_signal: Array.isArray(mockSignalData?.input_signal)
        ? [...mockSignalData.input_signal]
        : [],
      fft: {
        ...(mockSignalData?.fft || {}),
        out: Array.isArray(mockSignalData?.fft?.in)
          ? [...mockSignalData.fft.in]
          : []
      },
      spectrogram: {
        ...(mockSignalData?.spectrogram || {}),
        out: Array.isArray(mockSignalData?.spectrogram?.in)
          ? mockSignalData.spectrogram.in.map((row) => (Array.isArray(row) ? [...row] : row))
          : []
      }
    };
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

  const runAiSeparation = async () => {
    const inputSignal = signalData?.input_signal;
    if (!Array.isArray(inputSignal) || inputSignal.length === 0) {
      setAiError('No input signal available. Upload or load a signal first.');
      setAiComponents([]);
      return;
    }
    if (!Array.isArray(modeFreqBands) || modeFreqBands.length === 0) {
      setAiError('No bands/components are configured for this mode.');
      setAiComponents([]);
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const names = modeFreqBands.map((b, i) => String(b?.name || `Component ${i + 1}`));
      const sr = Number(uploadedSampleRate) || (activeModeId === 'ecg' ? 500 : 44100);

      const componentRequests = modeFreqBands.map((_, idx) => {
        const oneHot = modeFreqBands.map((__, i) => (i === idx ? 1 : 0));

        if (activeModeId === 'music') {
          return processMusicMode(inputSignal, oneHot, names, sr, 'fft', waveletType, 6, null);
        }
        if (activeModeId === 'animal') {
          return processAnimalsMode(inputSignal, oneHot, names, sr, 'fft', waveletType, 6, null);
        }
        if (activeModeId === 'human') {
          return processHumansMode(inputSignal, oneHot, names, sr, 'fft', waveletType, 6, null);
        }
        if (activeModeId === 'ecg') {
          return processECGMode(inputSignal, oneHot, names, sr, 'fft', waveletType, 6, null);
        }

        const singleBandConfig = modeFreqBands.map((b, i) => ({ ...b, gain: i === idx ? 1 : 0 }));
        return processGenericMode(inputSignal, singleBandConfig, sr, 'fft', waveletType, 6, null);
      });

      const responses = await Promise.all(componentRequests);
      const extracted = responses.map((resp, idx) => {
        const out = Array.isArray(resp?.data?.output_signal) ? resp.data.output_signal : [];
        return {
          id: modeFreqBands[idx]?.id || `ai-${idx}`,
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

  const applyAiSoloToEqualizer = (componentIndex) => {
    setModeFreqBands(modeFreqBands.map((b, i) => ({ ...b, gain: i === componentIndex ? 1 : 0 })));
    setEqualizerTab('equalizer');
  };

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
    const modeDefault = getModeWaveletDefault(activeModeId);
    setWaveletType(modeDefault);
    setWaveletSliders(buildWaveletDefaults(modeDefault));
  }, [activeModeId]);

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
            {
              const selectedWavelet = normalizeWaveletName(response.data?.wavelet, getModeWaveletDefault('generic'));
              setWaveletType(selectedWavelet);
              setWaveletSliders(normalizeWaveletSliders(selectedWavelet, response.data?.sliders_wavelet));
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
              setWaveletSliders(normalizeWaveletSliders(selectedWavelet, response.data?.sliders_wavelet));
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
              setWaveletSliders(normalizeWaveletSliders(selectedWavelet, response.data?.sliders_wavelet));
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
              setWaveletSliders(normalizeWaveletSliders(selectedWavelet, response.data?.sliders_wavelet));
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
              setWaveletSliders(normalizeWaveletSliders(selectedWavelet, response.data?.sliders_wavelet));
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
      sliders_wavelet: waveletSliders,
      wavelet: waveletType,
      bands: modeFreqBands
    };
    
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

      const selectedWavelet = normalizeWaveletName(d.wavelet, getModeWaveletDefault(currentMode));
      setWaveletType(selectedWavelet);
      setWaveletSliders(normalizeWaveletSliders(selectedWavelet, d.sliders_wavelet));

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
    
    const selectedWavelet = normalizeWaveletName(settings.wavelet, getModeWaveletDefault(settings.mode || activeModeId));
    setWaveletType(selectedWavelet);
    setWaveletSliders(normalizeWaveletSliders(selectedWavelet, settings.sliders_wavelet));
    
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

  const prepareSignalForUi = (signal, sampleRate) => {
    if (!signal || signal.length === 0) {
      return { signal: [], sampleRate: Number(sampleRate) || 44100 };
    }

    const step = Math.max(1, Math.ceil(signal.length / MAX_UI_SIGNAL_SAMPLES));
    if (step === 1) {
      return {
        signal: Array.from(signal),
        sampleRate: Number(sampleRate) || 44100
      };
    }

    const reduced = [];
    for (let i = 0; i < signal.length; i += step) {
      reduced.push(Number(signal[i]) || 0);
    }

    return {
      signal: reduced,
      sampleRate: Math.round((Number(sampleRate) || 44100) / step)
    };
  };

  const handleModeSignalLoad = (signal, sampleRate, filename) => {
    // Reset transport to avoid stale offsets from previous files.
    handleStop();

    const prepared = prepareSignalForUi(signal, sampleRate);

    // Store the actual uploaded signal data for current mode
    setModeUploadedSignals(prev => ({
      ...prev,
      [activeModeId]: prepared.signal
    }));
    setModeUploadedSampleRates(prev => ({
      ...prev,
      [activeModeId]: prepared.sampleRate
    }));
    // Also update the audioFile name for display (per mode)
    setModeAudioFiles(prev => ({
      ...prev,
      [activeModeId]: {
        name: filename,
        size: prepared.signal.length * 4,
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
      const prepared = prepareSignalForUi(channel, decoded.sampleRate);
      return {
        signal: prepared.signal,
        sampleRate: prepared.sampleRate
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
        const prepared = prepareSignalForUi(backendSignal, backendSampleRate);
        setModeUploadedSignals(prev => ({
          ...prev,
          [activeModeId]: prepared.signal
        }));
        setModeUploadedSampleRates(prev => ({
          ...prev,
          [activeModeId]: prepared.sampleRate
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
                    <button 
                      type="button" 
                      className={`btn-xs ${processingMethod === 'wavelet' ? 'active' : ''}`}
                      onClick={() => {
                        setProcessingMethod('wavelet');
                        if (activeModeId === 'generic') {
                          setWaveletSliders(buildWaveletDefaults(waveletType));
                        }
                      }}
                      style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: processingMethod === 'wavelet' ? '#6366f1' : 'transparent', color: 'white', border: 'none', cursor: 'pointer' }}
                    >Wavelet</button>
                  </div>
                  <button 
                    type="button" 
                    className="icon-btn" 
                    onClick={() => {
                      setModeFreqBands(modeFreqBands.map((b) => ({ ...b, gain: 1 })));
                      if (processingMethod === 'wavelet' && activeModeId !== 'generic') {
                         setWaveletSliders(buildWaveletDefaults(waveletType));
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
                          <span className="band-info-gain">{Number(b.gain).toFixed(2)}×</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {processingMethod === 'wavelet' && (
                  <>
                    <div className="field" style={{ marginTop: '0.5rem' }}>
                      <span>Wavelet Basis</span>
                      <select
                        className="select"
                        value={waveletType}
                        onChange={(e) => {
                          const nextType = normalizeWaveletName(e.target.value, getModeWaveletDefault(activeModeId));
                          setWaveletType(nextType);
                          setWaveletSliders((prev) => normalizeWaveletSliders(nextType, prev));
                        }}
                      >
                        {WAVELET_BASIS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <p className="helper-text" style={{ marginTop: '0.2rem' }}>{recommendedWavelet}</p>
                  </>
                )}

              </div>
              <button type="button" className="btn btn-small" style={{ marginTop: '0.5rem' }} onClick={handleLoadPreset}>Load preset</button>
            </div>
          )}
          {equalizerTab === 'ai' && (
            <div className="box ai-box">
              <h2 className="box-title">AI Model Comparison</h2>
              <p className="helper-text">Run component separation for the current mode and inspect each isolated track.</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                <button type="button" className="btn btn-small" onClick={runAiSeparation} disabled={aiLoading}>
                  {aiLoading ? 'Separating...' : 'Run AI Separation'}
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => setModeFreqBands(modeFreqBands.map((b) => ({ ...b, gain: 1 })))}
                >
                  Reset EQ Gains
                </button>
              </div>

              {aiError && <p className="helper-text" style={{ color: '#fda4af' }}>{aiError}</p>}

              {!aiLoading && !aiError && aiComponents.length === 0 && (
                <p className="helper-text">No separated components yet. Click Run AI Separation.</p>
              )}

              {!aiLoading && aiComponents.length > 0 && (
                <div className="bands-info" style={{ marginTop: '0.25rem' }}>
                  {aiComponents.map((comp, idx) => (
                    <div key={comp.id} className="band-info-item" style={{ alignItems: 'center', gap: '0.5rem' }}>
                      <span className="band-info-label">{comp.name}</span>
                      <span className="band-info-gain">RMS {comp.rms.toFixed(4)}</span>
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

          {activeModeId !== 'generic' && signalData?.wavelet && (
            <div className="row section-row">
              <h2 className="section-title">Wavelet Graph ({activeWaveletBasis.label})</h2>
              <div className="row">
                <div className="box chart-box">
                  <WaveletChart data={signalData?.wavelet} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
