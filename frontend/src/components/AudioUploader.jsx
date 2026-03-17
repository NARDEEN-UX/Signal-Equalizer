import React, { useRef } from 'react';
import { loadSampleHuman } from '../api';

import { audioBufferToWav } from '../utils/audioUtils';

const AudioUploader = ({ onFileSelect, onSettingsSelect, currentFileName }) => {
  const inputRef = useRef(null);
  const settingsRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    let finalFile = file;
    if (file.name.toLowerCase().match(/\.(m4a|mp4|aac)$/)) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const wavBlob = audioBufferToWav(decoded);
        finalFile = new File([wavBlob], file.name.replace(/\.[^/.]+$/, '') + '.wav', { type: 'audio/wav' });
        await audioCtx.close();
      } catch (err) {
        alert('Failed to convert M4A to WAV: ' + err.message);
        return;
      }
    }
    onFileSelect(finalFile);
  };

  const handleSettingsFile = (file) => {
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          onSettingsSelect(settings);
        } catch (err) {
          alert('Error parsing settings file: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else {
      alert('Please select a valid JSON settings file');
    }
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
      <input 
        ref={inputRef} 
        type="file" 
        accept="audio/*,.wav,.mp3,.m4a,.aac,.mp4" 
        onChange={(e) => handleFile(e.target.files?.[0])} 
        style={{ display: 'none' }} 
      />
      <input 
        ref={settingsRef} 
        type="file" 
        accept=".json" 
        onChange={(e) => handleSettingsFile(e.target.files?.[0])} 
        style={{ display: 'none' }} 
      />
      <button type="button" className="btn btn-sample" onClick={loadSample} title="Load sample (Human: 4-voice mix)">
        <span className="btn-icon">◐</span> Sample
      </button>
      <button type="button" className="btn btn-settings" onClick={() => settingsRef.current?.click()} title="Load settings file (JSON)">
        <span className="btn-icon">⚙</span> Settings
      </button>
      <button type="button" className="btn btn-upload primary" onClick={() => inputRef.current?.click()}>
        <span className="btn-icon">↑</span> Upload
      </button>
    </div>
  );
};

export default AudioUploader;
