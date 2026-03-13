import React, { useRef } from 'react';
import { loadSampleHuman } from '../api';

const AudioUploader = ({ onFileSelect, currentFileName }) => {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (file) onFileSelect(file);
  };

  const loadSample = () => {
    loadSampleHuman()
      .then((res) => {
        const blob = res.data;
        const file = new File([blob], 'human_sample.wav', { type: 'audio/wav' });
        onFileSelect(file);
      })
      .catch(() => {});
  };

  return (
    <div className="controls-row">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3"
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
      <button className="btn primary" onClick={() => inputRef.current?.click()}>
        Upload
      </button>
      <button className="btn" onClick={loadSample}>
        Load sample (Human)
      </button>
      {currentFileName && <span className="text-dim">{currentFileName}</span>}
    </div>
  );
};

export default AudioUploader;
