import React, { useState, useEffect, useMemo, useRef } from 'react';
import WaveformViewer from './components/WaveformViewer';
import SliderGroup from './components/SliderGroup';
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
import { saveSchema, loadSchema, getGenericDefault, getMusicDefault, getAnimalsDefault, getHumansDefault, getECGDefault, uploadAudio } from './api';

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
    sliderLabels: ['Bass', 'Piano', 'Vocals', 'Violin'],
    allowAddSubdivision: false,
    requirements: ['Bass instrument', 'Piano', 'Vocal tracks', 'Violin']
  },
  {
    id: 'animal',
    name: 'Animal Sounds',
    tag: 'Animal mixture',
    description: 'Adjust different animal sounds in a complex mixture.',
    accentClass: 'mode-animal',
    icon: '❖',
    sliderLabels: ['Birds', 'Dogs', 'Cats', 'Others'],
    allowAddSubdivision: false,
    requirements: ['Bird sounds', 'Dog barks', 'Cat meows', 'Other animal sounds']
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
    sliderLabels: ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3'],
    allowAddSubdivision: false,
    requirements: ['Normal ECG', 'Atrial fibrillation', 'Ventricular tachycardia', 'Heart block']
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

function App() {
  const MAX_UI_SIGNAL_SAMPLES = 120000;
  const MIN_PLAYBACK_SAMPLE_RATE = 3000;
  const MAX_PLAYBACK_SAMPLE_RATE = 192000;

  const [view, setView] = useState('landing'); // 'landing' | 'workspace'
  const [homeMode, setHomeMode] = useState('Home');
  const [activeModeId, setActiveModeId] = useState('generic');
  const [freqSliders, setFreqSliders] = useState([1, 1, 1, 1]);
  const [waveletSliders, setWaveletSliders] = useState([1, 1, 1, 1]);
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
  const [genericBands, setGenericBands] = useState([
    { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1 },
    { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1 },
    { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1 },
    { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1 }
  ]);
  const [modeFreqConfig, setModeFreqConfig] = useState({
    music: [
      { id: 'music-0', name: 'Bass', low: 20, high: 250, gain: 1 },
      { id: 'music-1', name: 'Piano', low: 250, high: 4000, gain: 1 },
      { id: 'music-2', name: 'Vocals', low: 300, high: 3000, gain: 1 },
      { id: 'music-3', name: 'Violin', low: 200, high: 7000, gain: 1 }
    ],
    animal: [
      { id: 'animal-0', name: 'Birds', low: 2000, high: 8000, gain: 1 },
      { id: 'animal-1', name: 'Dogs', low: 500, high: 2000, gain: 1 },
      { id: 'animal-2', name: 'Cats', low: 1000, high: 4000, gain: 1 },
      { id: 'animal-3', name: 'Others', low: 100, high: 16000, gain: 1 }
    ],
    human: [
      { id: 'human-0', name: 'Voice 1', low: 80, high: 8000, gain: 1 },
      { id: 'human-1', name: 'Voice 2', low: 80, high: 8000, gain: 1 },
      { id: 'human-2', name: 'Voice 3', low: 80, high: 8000, gain: 1 },
      { id: 'human-3', name: 'Voice 4', low: 80, high: 8000, gain: 1 }
    ],
    ecg: [
      { id: 'ecg-0', name: 'Normal', low: 0.5, high: 45, gain: 1 },
      { id: 'ecg-1', name: 'Arrhythmia 1', low: 0.5, high: 45, gain: 1 },
      { id: 'ecg-2', name: 'Arrhythmia 2', low: 0.5, high: 45, gain: 1 },
      { id: 'ecg-3', name: 'Arrhythmia 3', low: 0.5, high: 45, gain: 1 }
    ]
  });
  const [waveletType, setWaveletType] = useState('haar');
  const [equalizerTab, setEqualizerTab] = useState('equalizer'); // 'equalizer' | 'ai'
  // Linked viewer window (0-1 normalized signal range) shared by input and output.
  const [linkedViewWindow, setLinkedViewWindow] = useState({ start: 0, end: 1 });

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const rafRef = useRef(null);
  const offsetTimeRef = useRef(0);

  const activeMode = MODES.find((m) => m.id === activeModeId) || MODES[0];

  // Convert preset mode sliders to band format for unified BandBuilder
  const modeFreqBands = activeModeId === 'generic' 
    ? genericBands 
    : (modeFreqConfig[activeModeId] || []).map((b, i) => ({
        ...b,
        gain: freqSliders[i] ?? 1
      }));

  const setModeFreqBands = (bands) => {
    if (activeModeId === 'generic') {
      setGenericBands(bands);
    } else {
      const gains = bands.map(b => Number(b.gain));
      setFreqSliders(gains);
      // Also update frequency config for this mode
      setModeFreqConfig(prev => ({
        ...prev,
        [activeModeId]: bands.map(b => ({
          id: b.id,
          name: b.name,
          low: b.low,
          high: b.high,
          gain: b.gain
        }))
      }));
    }
  };

  const mockSignalData = useMockProcessing({
    modeId: activeModeId,
    freqSliders,
    waveletSliders,
    genericBands: activeModeId === 'generic' ? genericBands : modeFreqBands,
    waveletType,
    inputSignal: uploadedSignal,
    sampleRate: uploadedSampleRate
  });

  const { data: backendSignalData } = useBackendProcessing({
    modeId: activeModeId,
    freqSliders,
    waveletSliders,
    genericBands: activeModeId === 'generic' ? genericBands : modeFreqBands,
    sampleRate: uploadedSampleRate,
    signalData: uploadedSignal || null,
    useFallback: true
  });

  // Prefer backend processing when a real uploaded signal exists.
  const signalData = uploadedSignal && backendSignalData ? backendSignalData : mockSignalData;

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

  useEffect(() => {
    if (signalData?.time?.length) {
      durationRef.current = signalData.time[signalData.time.length - 1];
    }
  }, [signalData]);

  // Load default settings when mode changes
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        let response;
        switch (activeModeId) {
          case 'generic':
            response = await getGenericDefault();
            if (response.data?.bands) {
              setGenericBands(response.data.bands);
            }
            if (response.data?.sliders_freq) {
              setFreqSliders(response.data.sliders_freq);
            }
            if (response.data?.sliders_wavelet) {
              setWaveletSliders(response.data.sliders_wavelet);
            }
            break;
          case 'music':
            response = await getMusicDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                music: response.data.bands
              }));
              setFreqSliders(response.data.bands.map(b => (b.gain ?? 1)));
            }
            if (response.data?.sliders_freq) {
              setFreqSliders(response.data.sliders_freq);
            }
            break;
          case 'animal':
            response = await getAnimalsDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                animal: response.data.bands
              }));
              setFreqSliders(response.data.bands.map(b => (b.gain ?? 1)));
            }
            if (response.data?.sliders_freq) {
              setFreqSliders(response.data.sliders_freq);
            }
            break;
          case 'human':
            response = await getHumansDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                human: response.data.bands
              }));
              setFreqSliders(response.data.bands.map(b => (b.gain ?? 1)));
            }
            if (response.data?.sliders_freq) {
              setFreqSliders(response.data.sliders_freq);
            }
            break;
          case 'ecg':
            response = await getECGDefault();
            if (response.data?.bands) {
              setModeFreqConfig(prev => ({
                ...prev,
                ecg: response.data.bands
              }));
              setFreqSliders(response.data.bands.map(b => (b.gain ?? 1)));
            }
            if (response.data?.sliders_freq) {
              setFreqSliders(response.data.sliders_freq);
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
      sliders_freq: freqSliders,
      sliders_wavelet: waveletSliders,
      ...(activeModeId === 'generic' && genericBands.length ? { generic_bands: genericBands } : {})
    };
    saveSchema('equalizer_preset.json', schema).then(() => {
      window.alert('Preset saved. You can edit the file in backend/schemas/ and load it later.');
    }).catch(() => {
      window.alert('Save failed (backend may be offline). Use Load preset when server is running.');
    });
  };
  const handleLoadPreset = () => {
    loadSchema('equalizer_preset.json').then((res) => {
      const d = res.data;
      if (d.mode) setActiveModeId(d.mode);
      if (Array.isArray(d.sliders_freq)) setFreqSliders(d.sliders_freq);
      if (Array.isArray(d.sliders_wavelet)) setWaveletSliders(d.sliders_wavelet);
      if (Array.isArray(d.generic_bands) && d.generic_bands.length) setGenericBands(d.generic_bands);
      window.alert('Preset loaded. Controls updated.');
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

    if (mode === 'generic') {
      setGenericBands(normalizedBands);
      return;
    }

    setModeFreqConfig((prev) => ({
      ...prev,
      [mode]: normalizedBands
    }));
    setFreqSliders(normalizedBands.map((b) => Number(b.gain) || 1));
  };

  const handleSettingsSelect = (settings) => {
    if (!settings) return;
    
    // Apply settings to current mode
    if (settings.mode) {
      setActiveModeId(settings.mode);
    }
    
    // Apply slider gains if available
    if (Array.isArray(settings.sliders_freq) && settings.sliders_freq.length > 0) {
      setFreqSliders(settings.sliders_freq);
    }
    
    if (Array.isArray(settings.sliders_wavelet) && settings.sliders_wavelet.length > 0) {
      setWaveletSliders(settings.sliders_wavelet);
    }
    
    // Apply band configurations for the mode
    if (settings.mode === 'generic' && Array.isArray(settings.bands)) {
      setGenericBands(settings.bands);
    } else if (settings.mode && settings.bands && Array.isArray(settings.bands)) {
      // For other modes, update the configuration
      setModeFreqConfig(prev => ({
        ...prev,
        [settings.mode]: settings.bands.map((b, i) => ({
          id: b.id || `${settings.mode}-${i}`,
          name: b.name || `Channel ${i + 1}`,
          low: b.low,
          high: b.high,
          gain: b.gain ?? 1
        }))
      }));
      // Update frequency sliders
      setFreqSliders(settings.bands.map(b => (b.gain ?? 1)));
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
        sampleRate: Math.max(
          MIN_PLAYBACK_SAMPLE_RATE,
          Math.min(MAX_PLAYBACK_SAMPLE_RATE, Number(sampleRate) || 44100)
        )
      };
    }

    const reduced = [];
    for (let i = 0; i < signal.length; i += step) {
      reduced.push(Number(signal[i]) || 0);
    }

    return {
      signal: reduced,
      sampleRate: Math.max(
        MIN_PLAYBACK_SAMPLE_RATE,
        Math.min(MAX_PLAYBACK_SAMPLE_RATE, Math.round((Number(sampleRate) || 44100) / step))
      )
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
    // Frontend-only UI for now
    window.alert('Export سيتم ربطها لاحقًا بالباك إند (تحميل WAV).');
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
                  <button 
                    type="button" 
                    className="icon-btn" 
                    onClick={() => {
                      if (activeModeId === 'generic') {
                        setGenericBands(genericBands.map((b) => ({ ...b, gain: 1 })));
                      } else {
                        setFreqSliders([1, 1, 1, 1]);
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
                  labels={modeFreqBands && modeFreqBands.length > 0 ? modeFreqBands.map((b) => b.name) : []} 
                  values={modeFreqBands && modeFreqBands.length > 0 ? modeFreqBands.map((b) => Number(b.gain)) : []} 
                  onChange={(gains) => {
                    setModeFreqBands(
                      modeFreqBands.map((b, i) => ({ ...b, gain: gains[i] }))
                    );
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
                  <div className="bands-info">
                    {modeFreqBands.map((b) => (
                      <div key={b.id} className="band-info-item">
                        <span className="band-info-label">{b.name}</span>
                        <span className="band-info-gain">{Number(b.gain).toFixed(2)}×</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sliders - Works for all modes */}
                {modeFreqBands.length > 0 && (
                  <SliderGroup 
                    count={modeFreqBands.length} 
                    labels={modeFreqBands.map((b) => b.name)} 
                    values={modeFreqBands.map((b) => Number(b.gain))} 
                    onChange={(gains) => {
                      setModeFreqBands(
                        modeFreqBands.map((b, i) => ({ ...b, gain: gains[i] }))
                      );
                    }} 
                  />
                )}
              </div>
            </div>
          )}
          {equalizerTab === 'equalizer' && (
            <>
              <div className="box wavelet-box">
                <h2 className="box-title">Wavelet</h2>
                <SliderGroup count={4} labels={['L1', 'L2', 'L3', 'L4']} values={waveletSliders} onChange={setWaveletSliders} />
                <div className="field" style={{ marginTop: '0.5rem' }}>
                  <span>Basis</span>
                  <select className="select" value={waveletType} onChange={(e) => setWaveletType(e.target.value)}>
                    <option value="haar">Haar</option>
                    <option value="db4">Daubechies 4</option>
                    <option value="sym5">Symlet 5</option>
                  </select>
                </div>
                <button type="button" className="btn btn-small" style={{ marginTop: '0.5rem' }} onClick={handleLoadPreset}>Load preset</button>
              </div>
            </>
          )}
          {equalizerTab === 'ai' && (
            <div className="box ai-box">
              <h2 className="box-title">AI Model Comparison</h2>
              <p className="helper-text">Connect a pretrained AI model per mode to compare with the equalizer.</p>
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
                <FFTChart data={signalData?.fft} audiogram={audiogram} variant="input" />
                <span className="card-zoom">{linkedZoom.toFixed(1)}×</span>
              </div>
              <div className="box chart-box card-with-zoom">
                <h3 className="box-label">Output FFT</h3>
                <FFTChart data={signalData?.fft} audiogram={audiogram} variant="output" />
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

          {activeModeId !== 'generic' && (
            <div className="row section-row">
              <h2 className="section-title">Wavelet Domain Energy</h2>
              <div className="row two-boxes">
                <div className="box chart-box">
                  <h3 className="box-label">Input</h3>
                  <WaveletChart data={signalData?.wavelet} variant="input" />
                </div>
                <div className="box chart-box">
                  <h3 className="box-label">Output</h3>
                  <WaveletChart data={signalData?.wavelet} variant="output" />
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
