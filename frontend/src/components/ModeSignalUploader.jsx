import React, { useState, useEffect, useRef } from 'react';
import {
  uploadMusicSignal, loadMusicSignal, deleteMusicSignal,
  uploadAnimalSignal, loadAnimalSignal, deleteAnimalSignal,
  uploadHumanSignal, loadHumanSignal, deleteHumanSignal,
  uploadECGSignal, loadECGSignal, deleteECGSignal,
  uploadGenericSignal, loadGenericSignal, deleteGenericSignal,
  loadSampleGeneric, loadSampleMusic, loadSampleAnimals, loadSampleHuman, loadSampleECG
} from '../api';
import { audioBufferToWav } from '../utils/audioUtils';

const SESSION_SIGNALS_BY_MODE = {
  music: [],
  animal: [],
  human: [],
  ecg: [],
  generic: []
};

const MAX_SESSION_CACHED_SAMPLES = 600000;

function parseNumberList(raw, fallback = []) {
  if (typeof raw !== 'string') return fallback;
  const values = raw
    .split(',')
    .map((token) => Number(token.trim()))
    .filter((n) => Number.isFinite(n));
  return values.length ? values : fallback;
}

function waveformSample(type, phaseRad) {
  const wrapped = ((phaseRad + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (type === 'square') return wrapped >= 0 ? 1 : -1;
  if (type === 'sawtooth') return wrapped / Math.PI;
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(wrapped));
  return Math.sin(wrapped);
}

function snapFrequencyToBin(freqHz, sampleRate, nfft = 1024) {
  const nyquist = Math.max(2, sampleRate / 2);
  const f = Math.max(1, Math.min(nyquist - 1, Number(freqHz) || 1));
  const fftLength = Math.max(2, Math.floor(Number(nfft) || 1024));
  const bin = Math.max(1, Math.round((f * fftLength) / sampleRate));
  return (bin * sampleRate) / fftLength;
}

const ModeSignalUploader = ({ mode, onSignalLoad, onClose }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [synthDurationSec, setSynthDurationSec] = useState('3');
  const [synthSampleRate, setSynthSampleRate] = useState('44100');
  const [synthWaveform, setSynthWaveform] = useState('sine');
  const [synthFreqs, setSynthFreqs] = useState('440');
  const [synthAmps, setSynthAmps] = useState('1');
  const [synthPhaseDeg, setSynthPhaseDeg] = useState('0');
  const [synthNoiseLevel, setSynthNoiseLevel] = useState('0');
  const [synthSnapToBins, setSynthSnapToBins] = useState(true);
  const fileInputRef = useRef(null);

  // Map mode to API functions
  const apiMap = {
    music: { upload: uploadMusicSignal, load: loadMusicSignal, delete: deleteMusicSignal },
    animal: { upload: uploadAnimalSignal, load: loadAnimalSignal, delete: deleteAnimalSignal },
    human: { upload: uploadHumanSignal, load: loadHumanSignal, delete: deleteHumanSignal },
    ecg: { upload: uploadECGSignal, load: loadECGSignal, delete: deleteECGSignal },
    generic: { upload: uploadGenericSignal, load: loadGenericSignal, delete: deleteGenericSignal }
  };

  // Map mode to sample loaders
  const sampleMap = {
    generic: loadSampleGeneric,
    music: loadSampleMusic,
    animal: loadSampleAnimals,
    human: loadSampleHuman,
    ecg: loadSampleECG
  };

  useEffect(() => {
    setSignals(Array.isArray(SESSION_SIGNALS_BY_MODE[mode]) ? [...SESSION_SIGNALS_BY_MODE[mode]] : []);
    setError('');
  }, [mode]);

  const handleUpload = async (e) => {
    let file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      // Convert M4A/AAC to WAV client-side to bypass backend soundfile limitations
      if (file.name.toLowerCase().match(/\.(m4a|mp4|aac)$/)) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const wavBlob = audioBufferToWav(decoded);
        file = new File([wavBlob], file.name.replace(/\.[^/.]+$/, '') + '.wav', { type: 'audio/wav' });
        await audioCtx.close();
      }

      const response = await api.upload(file);
      const uploaded = response?.data || {};
      const storageName = uploaded.filename || `${mode}_${Date.now()}.wav`;
      const displayName = uploaded.original_name || file.name || storageName;
      const sessionEntry = {
        storageName,
        filename: displayName,
        size: Number(uploaded.size) || file.size || 0,
        sample_rate: Number(uploaded.sample_rate) || null,
        duration: Number(uploaded.duration) || null,
        samples: Number(uploaded.samples) || null,
        cachedSignal: null,
        cachedSampleRate: null
      };

      const currentSessionList = Array.isArray(SESSION_SIGNALS_BY_MODE[mode]) ? SESSION_SIGNALS_BY_MODE[mode] : [];
      SESSION_SIGNALS_BY_MODE[mode] = [
        sessionEntry,
        ...currentSessionList.filter((s) => (s?.storageName || s?.filename) !== sessionEntry.storageName)
      ];
      setSignals([...SESSION_SIGNALS_BY_MODE[mode]]);

      setSuccess(`Signal "${displayName}" uploaded successfully!`);
      setError('');

      // Decode in the background and keep an in-memory session cache for instant "Load".
      decodeSignalForSessionCache(file)
        .then((decoded) => {
          if (!decoded) return;
          SESSION_SIGNALS_BY_MODE[mode] = (SESSION_SIGNALS_BY_MODE[mode] || []).map((item) => {
            const itemStorage = item?.storageName || item?.filename;
            if (itemStorage !== storageName) return item;
            return {
              ...item,
              cachedSignal: decoded.signal,
              cachedSampleRate: decoded.sampleRate
            };
          });
          setSignals(Array.isArray(SESSION_SIGNALS_BY_MODE[mode]) ? [...SESSION_SIGNALS_BY_MODE[mode]] : []);
        })
        .catch(() => {
          // Cache is optional; fallback to backend load endpoint when unavailable.
        });

      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
      setError('Upload failed: ' + (typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg));
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const decodeSignalForSessionCache = async (file) => {
    const extension = (file?.name || '').toLowerCase();
    if (extension.endsWith('.csv')) return null;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const buffer = await file.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
      const channel = decoded.getChannelData(0);
      if (!channel || channel.length === 0 || channel.length > MAX_SESSION_CACHED_SAMPLES) {
        return null;
      }
      return {
        signal: Array.from(channel),
        sampleRate: Number(decoded.sampleRate) || 44100
      };
    } finally {
      await audioCtx.close();
    }
  };

  /**
   * Parse a WAV ArrayBuffer manually. Handles sample rates too low for
   * AudioContext.decodeAudioData (e.g., ECG at 500 Hz).
   */
  const parseWavBuffer = (buffer) => {
    const view = new DataView(buffer);
    // RIFF header check
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (riff !== 'RIFF') throw new Error('Not a valid WAV file');

    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);

    // Find "data" sub-chunk
    let offset = 12;
    while (offset < view.byteLength - 8) {
      const id = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      const size = view.getUint32(offset + 4, true);
      if (id === 'data') {
        offset += 8;
        const bytesPerSample = bitsPerSample / 8;
        const numSamples = Math.floor(size / (bytesPerSample * numChannels));
        const signal = new Float32Array(numSamples);

        for (let i = 0; i < numSamples; i++) {
          const byteOffset = offset + i * bytesPerSample * numChannels;
          if (bytesPerSample === 4) {
            signal[i] = view.getFloat32(byteOffset, true);
          } else if (bytesPerSample === 2) {
            signal[i] = view.getInt16(byteOffset, true) / 32768;
          } else {
            signal[i] = (view.getUint8(byteOffset) - 128) / 128;
          }
        }
        return { signal: Array.from(signal), sampleRate };
      }
      offset += 8 + size;
    }
    throw new Error('No data chunk found in WAV');
  };

  const handleLoadSample = async () => {
    const loader = sampleMap[mode];
    if (!loader) {
      setError('No synthetic sample available for this mode.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await loader();
      const blob = response.data;
      const arrayBuffer = await blob.arrayBuffer();

      let signal, sampleRate;

      // Try browser decode first; fall back to manual WAV parse for low sample rates
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        try {
          const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
          signal = Array.from(decoded.getChannelData(0));
          sampleRate = decoded.sampleRate;
        } finally {
          await audioCtx.close();
        }
      } catch {
        // Manual parse for files the browser can't decode (e.g. ECG at 500 Hz)
        const parsed = parseWavBuffer(arrayBuffer);
        signal = parsed.signal;
        sampleRate = parsed.sampleRate;
      }

      const sampleName = `${mode}_synthetic_sample.wav`;
      onSignalLoad(signal, sampleRate, sampleName);
      setSuccess(`Synthetic ${getModeLabel()} sample loaded!`);
      setTimeout(onClose, 500);
    } catch (err) {
      setError('Failed to load sample: ' + (err.message || 'Unknown error'));
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSignal = async (signalEntry) => {
    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      const storageName = String(signalEntry?.storageName || signalEntry?.filename || '');
      const displayName = String(signalEntry?.filename || storageName || 'signal');
      if (!storageName) {
        throw new Error('Missing signal filename');
      }

      const cachedEntry = (SESSION_SIGNALS_BY_MODE[mode] || []).find((s) => (s?.storageName || s?.filename) === storageName);
      if (cachedEntry && Array.isArray(cachedEntry.cachedSignal) && cachedEntry.cachedSignal.length > 0) {
        onSignalLoad(cachedEntry.cachedSignal, cachedEntry.cachedSampleRate || cachedEntry.sample_rate || 44100, displayName);
        setSuccess(`Signal "${displayName}" loaded instantly from session cache.`);
        setError('');
        setLoading(false);
        setTimeout(onClose, 250);
        return;
      }

      const response = await api.load(storageName);
      const signal = response.data.signal;
      const sampleRate = response.data.sample_rate;

      onSignalLoad(signal, sampleRate, displayName);
      setSuccess(`Signal "${displayName}" loaded successfully!`);
      setError('');

      setLoading(false);
      setTimeout(onClose, 500);
    } catch (err) {
      setError('Failed to load signal: ' + (err.response?.data?.detail || err.message));
      setSuccess('');
      setLoading(false);
    }
  };

  const handleGenerateSynthetic = () => {
    try {
      const durationSec = Math.max(0.2, Math.min(60, Number(synthDurationSec) || 3));
      const sampleRate = Math.max(500, Math.min(96000, Math.round(Number(synthSampleRate) || 44100)));
      const phaseRad = ((Number(synthPhaseDeg) || 0) * Math.PI) / 180;
      const noiseLevel = Math.max(0, Math.min(1, Number(synthNoiseLevel) || 0));
      const nyquist = Math.max(2, sampleRate / 2);
      const sampleCount = Math.max(1, Math.floor(durationSec * sampleRate));

      let freqs = parseNumberList(synthFreqs, [440]).map((f) => Math.max(1, Math.min(nyquist - 1, f)));
      if (synthSnapToBins) {
        // Snap to the actual FFT grid of the generated signal (not a fixed STFT window).
        freqs = freqs.map((f) => snapFrequencyToBin(f, sampleRate, sampleCount));
      }
      const ampsRaw = parseNumberList(synthAmps, [1]);
      const amps = freqs.map((_, i) => {
        const a = Number.isFinite(ampsRaw[i]) ? ampsRaw[i] : ampsRaw[ampsRaw.length - 1] || 1;
        return Math.max(0, Math.min(2, a));
      });

      const out = new Array(sampleCount);

      const ampSum = amps.reduce((sum, v) => sum + v, 0);
      const normalizer = ampSum > 1 ? (1 / ampSum) : 1;
      const fadeSamples = Math.max(1, Math.floor(sampleRate * 0.01)); // 10 ms fade to avoid edge discontinuities

      for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        let v = 0;
        for (let k = 0; k < freqs.length; k += 1) {
          const phase = 2 * Math.PI * freqs[k] * t + phaseRad;
          v += amps[k] * waveformSample(synthWaveform, phase);
        }
        v *= normalizer;

        // Apply short fade in/out to reduce spectral smearing from hard boundaries.
        if (i < fadeSamples) {
          v *= i / fadeSamples;
        } else if (i >= sampleCount - fadeSamples) {
          v *= (sampleCount - 1 - i) / fadeSamples;
        }

        if (noiseLevel > 0) {
          v += (Math.random() * 2 - 1) * noiseLevel;
        }
        out[i] = Math.max(-1, Math.min(1, v));
      }

      const fileName = `generic_synth_${synthWaveform}_${Date.now()}.wav`;
      onSignalLoad(out, sampleRate, fileName);
      setSuccess(`Synthetic signal generated (${synthWaveform}, ${freqs.length} tone${freqs.length > 1 ? 's' : ''}).`);
      setError('');
      setTimeout(onClose, 250);
    } catch (err) {
      setError(`Synthetic generation failed: ${err?.message || 'Unknown error'}`);
      setSuccess('');
    }
  };

  const applyPureSinePreset = () => {
    setSynthWaveform('sine');
    setSynthFreqs('440');
    setSynthAmps('1');
    setSynthPhaseDeg('0');
    setSynthNoiseLevel('0');
    setSynthSnapToBins(true);
  };

  const handleDeleteSignal = async (signalEntry) => {
    const storageName = String(signalEntry?.storageName || signalEntry?.filename || '');
    const displayName = String(signalEntry?.filename || storageName || 'signal');
    if (!storageName) return;
    if (!window.confirm(`Are you sure you want to delete "${displayName}"?`)) return;

    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      await api.delete(storageName);
      const currentSessionList = Array.isArray(SESSION_SIGNALS_BY_MODE[mode]) ? SESSION_SIGNALS_BY_MODE[mode] : [];
      SESSION_SIGNALS_BY_MODE[mode] = currentSessionList.filter((s) => (s?.storageName || s?.filename) !== storageName);
      setSignals([...SESSION_SIGNALS_BY_MODE[mode]]);
      setSuccess(`Signal "${displayName}" deleted successfully!`);
      setError('');
    } catch (err) {
      setError('Failed to delete signal: ' + (err.response?.data?.detail || err.message));
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const getModeLabel = () => {
    const labels = {
      music: 'Music',
      animal: 'Animal',
      human: 'Human',
      ecg: 'ECG',
      generic: 'Generic'
    };
    return labels[mode] || mode;
  };

  return (
    <div className="mode-signal-uploader-overlay" onClick={onClose}>
      <div className="mode-signal-uploader-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="uploader-header">
          <h3>{getModeLabel()} Mode - Signal Manager</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="uploader-content">
          <div className="upload-section">
            <h4>Upload New Signal</h4>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.ogg,.csv"
              onChange={handleUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <span className="btn-icon">↑</span> Choose Audio File
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleLoadSample}
                disabled={loading}
                title={`Load a synthetic ${getModeLabel()} sample generated by the backend`}
              >
                <span className="btn-icon">⚡</span> Load Synthetic Sample
              </button>
            </div>
          </div>

          {mode === 'generic' && (
            <div className="upload-section" style={{ marginTop: '0.75rem' }}>
              <h4>Synthetic Signal Maker (Generic)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                <label className="field" style={{ margin: 0 }}>
                  <span>Duration (sec)</span>
                  <input className="input" type="number" min="0.2" max="60" step="0.1" value={synthDurationSec} onChange={(e) => setSynthDurationSec(e.target.value)} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Sample Rate (Hz)</span>
                  <input className="input" type="number" min="500" max="96000" step="1" value={synthSampleRate} onChange={(e) => setSynthSampleRate(e.target.value)} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Waveform</span>
                  <select className="select" value={synthWaveform} onChange={(e) => setSynthWaveform(e.target.value)}>
                    <option value="sine">Sine</option>
                    <option value="square">Square</option>
                    <option value="triangle">Triangle</option>
                    <option value="sawtooth">Sawtooth</option>
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Global Phase (deg)</span>
                  <input className="input" type="number" min="-180" max="180" step="1" value={synthPhaseDeg} onChange={(e) => setSynthPhaseDeg(e.target.value)} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Frequencies (Hz, CSV)</span>
                  <input className="input" type="text" value={synthFreqs} onChange={(e) => setSynthFreqs(e.target.value)} placeholder="220,440,880" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Amplitudes (CSV)</span>
                  <input className="input" type="text" value={synthAmps} onChange={(e) => setSynthAmps(e.target.value)} placeholder="1,0.5,0.25" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span>Noise Level (0..1)</span>
                  <input className="input" type="number" min="0" max="1" step="0.01" value={synthNoiseLevel} onChange={(e) => setSynthNoiseLevel(e.target.value)} />
                </label>
                <label className="field" style={{ margin: 0, alignSelf: 'end' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={synthSnapToBins} onChange={(e) => setSynthSnapToBins(Boolean(e.target.checked))} />
                    Snap Frequencies To FFT Bins
                  </span>
                </label>
              </div>
              <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={applyPureSinePreset} disabled={loading}>
                  Pure Sine Preset
                </button>
                <button className="btn btn-secondary" onClick={handleGenerateSynthetic} disabled={loading}>
                  <span className="btn-icon">∿</span> Generate Synthetic Signal
                </button>
                <span className="helper-text">Tip: For a pure sine, keep one frequency and one amplitude (e.g. 440 and 1). Amplitudes map 1:1 to frequencies; last amplitude repeats if fewer values are provided.</span>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="signals-list-section">
            <h4>Uploaded Signals ({signals.length})</h4>
            {loading && signals.length === 0 ? (
              <p className="loading-text">Loading signals...</p>
            ) : signals.length > 0 ? (
              <ul className="signals-list">
                {signals.map((signal) => (
                  <li key={signal.storageName || signal.filename} className="signal-item">
                    <div className="signal-info">
                      <strong className="signal-name">{signal.filename}</strong>
                      <div className="signal-details">
                        <span>{signal.duration?.toFixed(2)}s</span>
                        <span>•</span>
                        <span>{signal.sample_rate} Hz</span>
                        <span>•</span>
                        <span>{(signal.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <div className="signal-actions">
                      <button
                        className="btn btn-sm btn-load"
                        onClick={() => handleLoadSignal(signal)}
                        disabled={loading}
                      >
                        Load
                      </button>
                      <button
                        className="btn btn-sm btn-delete"
                        onClick={() => handleDeleteSignal(signal)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">No signals uploaded in this session yet. Upload a file or load a synthetic sample!</p>
            )}
          </div>
        </div>

        <div className="uploader-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ModeSignalUploader;
