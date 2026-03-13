import React, { useState, useEffect, useRef } from 'react';
import AudioUploader from './components/AudioUploader';
import WaveformViewer from './components/WaveformViewer';
import SliderGroup from './components/SliderGroup';
import EqualizerCurve from './components/EqualizerCurve';
import FFTChart from './components/FFTChart';
import WaveletChart from './components/WaveletChart';
import SpectrogramViewer from './components/SpectrogramViewer';
import TransportControls from './components/TransportControls';
import AudiogramToggle from './components/AudiogramToggle';
import ModeModal from './components/ModeModal';
import GenericBandBuilder from './components/GenericBandBuilder';
import './App.css';
import { useMockProcessing } from './mock/useMockProcessing';
import { saveSchema, loadSchema } from './api';

const MODES = [
  {
    id: 'generic',
    name: 'Generic Mode',
    tag: 'Flexible frequency bands',
    description: 'Customize frequency subdivisions with precise equalizer controls.',
    accentClass: 'mode-generic',
    icon: '⟟',
    sliderLabels: ['Band 1', 'Band 2', 'Band 3', 'Band 4']
  },
  {
    id: 'music',
    name: 'Musical Instruments',
    tag: 'Music.wav',
    description: 'Control individual instruments inside a musical mix.',
    accentClass: 'mode-music',
    icon: '♫',
    sliderLabels: ['Bass', 'Piano', 'Vocals', 'Violin']
  },
  {
    id: 'animal',
    name: 'Animal Sounds',
    tag: 'Animal mixture',
    description: 'Adjust different animal sounds in a complex mixture.',
    accentClass: 'mode-animal',
    icon: '❖',
    sliderLabels: ['Birds', 'Dogs', 'Cats', 'Others']
  },
  {
    id: 'human',
    name: 'Human Voices',
    tag: '4-speaker mix',
    description: 'Manage multiple human voices in a single recording.',
    accentClass: 'mode-human',
    icon: '⌁',
    sliderLabels: ['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4']
  },
  {
    id: 'ecg',
    name: 'ECG Abnormalities',
    tag: '4 ECG signals',
    description: 'Control magnitude of arrhythmia components (normal + 3 types).',
    accentClass: 'mode-ecg',
    icon: '♡',
    sliderLabels: ['Normal', 'Arrhythmia 1', 'Arrhythmia 2', 'Arrhythmia 3']
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
  const [view, setView] = useState('landing'); // 'landing' | 'workspace'
  const [homeMode, setHomeMode] = useState('Home');
  const [activeModeId, setActiveModeId] = useState('generic');
  const [audioFile, setAudioFile] = useState(null);
  const [freqSliders, setFreqSliders] = useState([1, 1, 1, 1]);
  const [waveletSliders, setWaveletSliders] = useState([1, 1, 1, 1]);
  const [audiogram, setAudiogram] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [genericBands, setGenericBands] = useState([]);
  const [waveletType, setWaveletType] = useState('haar');
  const [equalizerTab, setEqualizerTab] = useState('equalizer'); // 'equalizer' | 'ai'
  // Linked cine viewers: same time window for both (0–1 = full range)
  const [viewWindow, setViewWindow] = useState({ start: 0, end: 1 });

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const rafRef = useRef(null);

  const activeMode = MODES.find((m) => m.id === activeModeId) || MODES[0];

  const signalData = useMockProcessing({
    modeId: activeModeId,
    freqSliders,
    waveletSliders,
    genericBands,
    waveletType
  });

  useEffect(() => {
    if (signalData?.time?.length) {
      durationRef.current = signalData.time[signalData.time.length - 1];
    }
  }, [signalData]);

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

    stopAudio();

    const dt = signalData.time[1] - signalData.time[0] || 1 / 44100;
    const buffer = ctx.createBuffer(1, signalData.output_signal.length, 1 / dt);
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
    source.start(0);

    sourceRef.current = source;
    gainRef.current = gainNode;
    startTimeRef.current = ctx.currentTime;
    durationRef.current = signalData.time[signalData.time.length - 1];

    const tick = () => {
      if (!audioCtxRef.current || !isPlaying) return;
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * playbackRate;
      const clamped = Math.min(elapsed, durationRef.current);
      setPlaybackTime(clamped);
      if (elapsed < durationRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    };

    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (audioCtxRef.current) {
      audioCtxRef.current.suspend();
    }
  };

  const handleStop = () => {
    stopAudio();
    setIsPlaying(false);
    setPlaybackTime(0);
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

  // Linked cine viewers: zoom/pan/reset (same window for both)
  const zoomFactor = 0.85;
  const panStep = 0.05;
  const handleZoomIn = () => {
    setViewWindow((w) => {
      const mid = (w.start + w.end) / 2;
      const half = (w.end - w.start) * zoomFactor / 2;
      return { start: Math.max(0, mid - half), end: Math.min(1, mid + half) };
    });
  };
  const handleZoomOut = () => {
    setViewWindow((w) => {
      const mid = (w.start + w.end) / 2;
      const half = Math.min(0.5, (w.end - w.start) / (2 * zoomFactor)) ;
      return { start: Math.max(0, mid - half), end: Math.min(1, mid + half) };
    });
  };
  const handlePanLeft = () => {
    setViewWindow((w) => {
      const d = w.end - w.start;
      const s = Math.max(0, w.start - panStep);
      return { start: s, end: Math.min(1, s + d) };
    });
  };
  const handlePanRight = () => {
    setViewWindow((w) => {
      const d = w.end - w.start;
      const e = Math.min(1, w.end + panStep);
      return { start: Math.max(0, e - d), end: e };
    });
  };
  const handleResetView = () => setViewWindow({ start: 0, end: 1 });

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

  const handleExport = () => {
    // Frontend-only UI for now
    window.alert('Export سيتم ربطها لاحقًا بالباك إند (تحميل WAV).');
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
          <AudioUploader onFileSelect={setAudioFile} currentFileName={audioFile?.name} />
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

      <div className="workspace-body">
        <aside className="workspace-left">
          {equalizerTab === 'equalizer' && (
            <div className="box equalizer-box">
              <div className="box-head">
                <h2 className="box-title">Equalizer Controls</h2>
                <div className="box-actions">
                  <button type="button" className="icon-btn" onClick={() => setFreqSliders([1, 1, 1, 1])} title="Reset">↺</button>
                  <button type="button" className="icon-btn" onClick={handleSavePreset} title="Save">💾</button>
                </div>
              </div>
              {activeModeId === 'generic' ? (
                <GenericBandBuilder bands={genericBands} setBands={setGenericBands} />
              ) : (
                <>
                  <EqualizerCurve labels={activeMode.sliderLabels} values={freqSliders} onChange={setFreqSliders} />
                  <SliderGroup count={4} labels={activeMode.sliderLabels} values={freqSliders} onChange={setFreqSliders} />
                </>
              )}
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
                viewWindow={viewWindow}
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
                viewWindow={viewWindow}
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
                <span className="card-zoom">1.0×</span>
              </div>
              <div className="box chart-box card-with-zoom">
                <h3 className="box-label">Output FFT</h3>
                <FFTChart data={signalData?.fft} audiogram={audiogram} variant="output" />
                <span className="card-zoom">1.0×</span>
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
                  <h3 className="box-label">Input spectrogram</h3>
                  <SpectrogramViewer title="" times={signalData.spectrogram.t} freqs={signalData.spectrogram.f} magnitudes={signalData.spectrogram.in} />
                </div>
                <div className="box chart-box">
                  <h3 className="box-label">Output spectrogram</h3>
                  <SpectrogramViewer title="" times={signalData.spectrogram.t} freqs={signalData.spectrogram.f} magnitudes={signalData.spectrogram.out} />
                </div>
              </div>
            )}
          </div>

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
        </main>
      </div>
    </div>
  );
}

export default App;
