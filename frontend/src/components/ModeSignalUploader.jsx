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

const ModeSignalUploader = ({ mode, onSignalLoad, onClose }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
