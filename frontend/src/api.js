import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000' });

export const uploadAudio = (file) => {
  const formData = new FormData();
  formData.append('audio', file);
  return API.post('/upload', formData);
};

export const uploadsAudioWithSettings = (audioFile, settingsFile) => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  if (settingsFile) {
    formData.append('settings', settingsFile);
  }
  return API.post('/upload', formData);
};

export const loadSampleHuman = () => API.get('/sample/human', { responseType: 'blob' });

export const processSignals = (mode, slidersFreq, slidersWavelet) => {
  return API.post('/process', { mode, sliders_freq: slidersFreq, sliders_wavelet: slidersWavelet });
};

export const saveSchema = (filename, schema) => {
  return API.post('/save_schema', { filename, schema });
};

export const loadSchema = (filename) => {
  return API.post('/load_schema', { filename });
};

export const saveSettings = (mode, settings) => {
  return API.post('/save-settings', { mode, settings });
};

export const loadSettings = (filename) => {
  return API.post('/load-settings', { filename });
};

// Mode-specific API calls
export const processGenericMode = (signal, bands, gains) => {
  return API.post('/api/modes/generic/process', {
    signal,
    bands: bands.map(b => ({
      id: b.id,
      name: b.name,
      low: b.low,
      high: b.high,
      gain: b.gain
    })),
    sample_rate: 44100
  });
};

export const processMusicMode = (signal, gains, instrumentNames) => {
  return API.post('/api/modes/music/process', {
    signal,
    gains,
    instrument_names: instrumentNames,
    sample_rate: 44100
  });
};

export const processAnimalsMode = (signal, gains, animalNames) => {
  return API.post('/api/modes/animals/process', {
    signal,
    gains,
    animal_names: animalNames,
    sample_rate: 44100
  });
};

export const processHumansMode = (signal, gains, voiceNames) => {
  return API.post('/api/modes/humans/process', {
    signal,
    gains,
    voice_names: voiceNames,
    sample_rate: 44100
  });
};

export const processECGMode = (signal, gains, componentNames) => {
  return API.post('/api/modes/ecg/process', {
    signal,
    gains,
    component_names: componentNames,
    sample_rate: 500
  });
};

