import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

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
export const processGenericMode = (signal, bands, sampleRate = 44100) => {
  return API.post('/api/modes/generic/process', {
    signal,
    bands: bands.map(b => ({
      id: b.id,
      name: b.name,
      low: b.low,
      high: b.high,
      gain: b.gain
    })),
    sample_rate: sampleRate
  });
};

export const processMusicMode = (signal, gains, instrumentNames, sampleRate = 44100) => {
  return API.post('/api/modes/music/process', {
    signal,
    gains,
    instrument_names: instrumentNames,
    sample_rate: sampleRate
  });
};

export const processAnimalsMode = (signal, gains, animalNames, sampleRate = 44100) => {
  return API.post('/api/modes/animals/process', {
    signal,
    gains,
    animal_names: animalNames,
    sample_rate: sampleRate
  });
};


export const processHumansMode = (signal, gains, voiceNames, sampleRate = 44100, customFreqRanges = null) => {
  const payload = {
    signal,
    gains,
    voice_names: voiceNames,
    sample_rate: sampleRate
  };
  if (customFreqRanges && Array.isArray(customFreqRanges)) {
    payload.custom_freq_ranges = customFreqRanges;
  }
  return API.post('/api/modes/humans/process', payload);
};

export const processECGMode = (signal, gains, componentNames, sampleRate = 500) => {
  return API.post('/api/modes/ecg/process', {
    signal,
    gains,
    component_names: componentNames,
    sample_rate: sampleRate
  });
};

// Get default settings for each mode
export const getGenericDefault = () => {
  return API.get('/api/modes/generic/settings/default');
};

export const getMusicDefault = () => {
  return API.get('/api/modes/music/settings/default');
};

export const getAnimalsDefault = () => {
  return API.get('/api/modes/animals/settings/default');
};

export const getHumansDefault = () => {
  return API.get('/api/modes/humans/settings/default');
};

export const getECGDefault = () => {
  return API.get('/api/modes/ecg/settings/default');
};

// ==================== Music Mode Signal Upload ====================

export const uploadMusicSignal = (file) => {
  const formData = new FormData();
  formData.append('signal_file', file);
  return API.post('/api/modes/music/upload-signal', formData);
};

export const listMusicSignals = () => {
  return API.get('/api/modes/music/signals');
};

export const loadMusicSignal = (filename) => {
  return API.post(`/api/modes/music/signal/${filename}/load`);
};

export const deleteMusicSignal = (filename) => {
  return API.delete(`/api/modes/music/signal/${filename}`);
};

// ==================== Animals Mode Signal Upload ====================

export const uploadAnimalSignal = (file) => {
  const formData = new FormData();
  formData.append('signal_file', file);
  return API.post('/api/modes/animals/upload-signal', formData);
};

export const listAnimalSignals = () => {
  return API.get('/api/modes/animals/signals');
};

export const loadAnimalSignal = (filename) => {
  return API.post(`/api/modes/animals/signal/${filename}/load`);
};

export const deleteAnimalSignal = (filename) => {
  return API.delete(`/api/modes/animals/signal/${filename}`);
};

// ==================== Humans Mode Signal Upload ====================

export const uploadHumanSignal = (file) => {
  const formData = new FormData();
  formData.append('signal_file', file);
  return API.post('/api/modes/humans/upload-signal', formData);
};

export const listHumanSignals = () => {
  return API.get('/api/modes/humans/signals');
};

export const loadHumanSignal = (filename) => {
  return API.post(`/api/modes/humans/signal/${filename}/load`);
};

export const deleteHumanSignal = (filename) => {
  return API.delete(`/api/modes/humans/signal/${filename}`);
};

// ==================== Human Test Voices ====================

export const listTestVoices = () => {
  return API.get('/api/modes/humans/test-voices');
};

export const loadTestVoice = (filename) => {
  return API.post(`/api/modes/humans/test-voices/${filename}/load`);
};

// ==================== ECG Mode Signal Upload ====================

export const uploadECGSignal = (file) => {
  const formData = new FormData();
  formData.append('signal_file', file);
  return API.post('/api/modes/ecg/upload-signal', formData);
};

export const listECGSignals = () => {
  return API.get('/api/modes/ecg/signals');
};

export const loadECGSignal = (filename) => {
  return API.post(`/api/modes/ecg/signal/${filename}/load`);
};

export const deleteECGSignal = (filename) => {
  return API.delete(`/api/modes/ecg/signal/${filename}`);
};

// ==================== Generic Mode Signal Upload ====================

export const uploadGenericSignal = (file) => {
  const formData = new FormData();
  formData.append('signal_file', file);
  return API.post('/api/modes/generic/upload-signal', formData);
};

export const listGenericSignals = () => {
  return API.get('/api/modes/generic/signals');
};

export const loadGenericSignal = (filename) => {
  return API.post(`/api/modes/generic/signal/${filename}/load`);
};

export const deleteGenericSignal = (filename) => {
  return API.delete(`/api/modes/generic/signal/${filename}`);
};

