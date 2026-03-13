import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000' });

export const uploadAudio = (file) => {
  const formData = new FormData();
  formData.append('audio', file);
  return API.post('/upload', formData);
};

/** Fetch Human mode sample WAV from backend, then upload it so it becomes the current signal. */
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