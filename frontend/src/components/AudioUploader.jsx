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
    <div className="controls-row header-upload">
      <input ref={inputRef} type="file" accept="audio/*,.wav,.mp3" onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
      <button type="button" className="btn btn-sample" onClick={loadSample} title="Load sample (Human: 4-voice mix)">
        <span className="btn-icon">◐</span> Sample
      </button>
      <button type="button" className="btn btn-upload primary" onClick={() => inputRef.current?.click()}>
        <span className="btn-icon">↑</span> Upload
      </button>
    </div>
  );
};

export default AudioUploader;
