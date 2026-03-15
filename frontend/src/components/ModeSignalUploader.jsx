import React, { useState, useEffect, useRef } from 'react';
import {
  uploadMusicSignal, listMusicSignals, loadMusicSignal, deleteMusicSignal,
  uploadAnimalSignal, listAnimalSignals, loadAnimalSignal, deleteAnimalSignal,
  uploadHumanSignal, listHumanSignals, loadHumanSignal, deleteHumanSignal,
  uploadECGSignal, listECGSignals, loadECGSignal, deleteECGSignal,
  uploadGenericSignal, listGenericSignals, loadGenericSignal, deleteGenericSignal
} from '../api';

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
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const api = apiMap[mode];
      if (!api) return;

      const response = await api.upload(file);
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
              accept="audio/*,.wav,.mp3,.flac,.ogg"
              onChange={handleUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <span className="btn-icon">↑</span> Choose Audio File
            </button>
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
              <p className="empty-message">No signals uploaded yet. Upload your first signal!</p>
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
