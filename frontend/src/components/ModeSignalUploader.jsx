import React, { useState, useEffect, useRef } from 'react';
import {
  uploadMusicSignal, listMusicSignals, loadMusicSignal, deleteMusicSignal,
  uploadAnimalSignal, listAnimalSignals, loadAnimalSignal, deleteAnimalSignal,
  uploadHumanSignal, listHumanSignals, loadHumanSignal, deleteHumanSignal,
  uploadECGSignal, listECGSignals, loadECGSignal, deleteECGSignal,
  uploadGenericSignal, listGenericSignals, loadGenericSignal, deleteGenericSignal,
  loadSampleGeneric, loadSampleMusic, loadSampleAnimals, loadSampleHuman, loadSampleECG
} from '../api';
import { audioBufferToWav } from '../utils/audioUtils';

const ModeSignalUploader = ({ mode, onSignalLoad, onClose }) => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Map mode to API functions
  const apiMap = {
    music: { upload: uploadMusicSignal, list: listMusicSignals, load: loadMusicSignal, delete: deleteMusicSignal },
    animal: { upload: uploadAnimalSignal, list: listAnimalSignals, load: loadAnimalSignal, delete: deleteAnimalSignal },
    human: { upload: uploadHumanSignal, list: listHumanSignals, load: loadHumanSignal, delete: deleteHumanSignal },
    ecg: { upload: uploadECGSignal, list: listECGSignals, load: loadECGSignal, delete: deleteECGSignal },
    generic: { upload: uploadGenericSignal, list: listGenericSignals, load: loadGenericSignal, delete: deleteGenericSignal }
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
    loadSignalsList();
  }, [mode]);

  const loadSignalsList = async () => {
    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      const response = await api.list();
      setSignals(response.data.signals || []);
      setError('');
    } catch (err) {
      setError('Failed to load signals list: ' + err.message);
      setSignals([]);
    } finally {
      setLoading(false);
    }
  };

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

      await api.upload(file);
      setSuccess(`Signal "${file.name}" uploaded successfully!`);
      setError('');

      // Reload signals list after upload
      await loadSignalsList();

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

  const handleLoadSignal = async (filename) => {
    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      const response = await api.load(filename);
      const signal = response.data.signal;
      const sampleRate = response.data.sample_rate;

      onSignalLoad(signal, sampleRate, filename);
      setSuccess(`Signal "${filename}" loaded successfully!`);
      setError('');

      setLoading(false);
      setTimeout(onClose, 500);
    } catch (err) {
      setError('Failed to load signal: ' + (err.response?.data?.detail || err.message));
      setSuccess('');
      setLoading(false);
    }
  };

  const handleDeleteSignal = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      await api.delete(filename);
      setSuccess(`Signal "${filename}" deleted successfully!`);
      setError('');

      await loadSignalsList();
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
                  <li key={signal.filename} className="signal-item">
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
                        onClick={() => handleLoadSignal(signal.filename)}
                        disabled={loading}
                      >
                        Load
                      </button>
                      <button
                        className="btn btn-sm btn-delete"
                        onClick={() => handleDeleteSignal(signal.filename)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">No signals uploaded yet. Upload a file or load a synthetic sample!</p>
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
