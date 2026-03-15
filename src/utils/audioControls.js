
// Speed options for playback
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Default playback speed
export const DEFAULT_SPEED = 1;

// Zoom multipliers
export const ZOOM_IN_FACTOR = 0.5;    // Zoom in by 50% (half the width)
export const ZOOM_OUT_FACTOR = 2;     // Zoom out by 100% (double the width)

// Time display format
export const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

// Zoom helper functions
export const calculateZoomRange = (currentRange, zoomFactor, timeData) => {
  const range = currentRange || [0, Math.max(...timeData)];
  const center = (range[0] + range[1]) / 2;
  const newWidth = (range[1] - range[0]) * zoomFactor;
  return [center - newWidth / 2, center + newWidth / 2];
};

export const zoomIn = (currentRange, timeData) => {
  return calculateZoomRange(currentRange, ZOOM_IN_FACTOR, timeData);
};

export const zoomOut = (currentRange, timeData) => {
  return calculateZoomRange(currentRange, ZOOM_OUT_FACTOR, timeData);
};

// Reset all parameters to defaults
export const getDefaultState = () => ({
  playbackRate: DEFAULT_SPEED,
  xRange: null,
  currentTime: 0,
  isPlaying: false,
  hasFinished: false
});

// Audio processing configuration
export const AUDIO_CONFIG = {
  targetPoints: 10000,        // Number of points to display on the graph
  sampleRate: null,           // Will be determined from audio buffer
};

// Plot styling
export const PLOT_STYLE = {
  darkColor: "#1e1e1e",
  purpleColor: "#b73acd",
  redColor: "#ff6b6b",
  gridColor: "#333",
  axisColor: "#9ad0ff",
  zerolineColor: "#555",
  zerolineWidth: 1,
  lineWidth: 2,
  dashLineWidth: 2,
};

// Control button styles
export const BUTTON_LABELS = {
  play: "▶ Play",
  pause: "⏸ Pause",
  replay: " Replay",
  stop: "⏹ Stop",
  zoomIn: "+ Zoom In",
  zoomOut: "- Zoom Out",
  reset: " Reset",
};

// FFT Scale options
export const FFT_SCALES = {
  LINEAR: "linear",
  LOG: "log",
};

export const FFT_SCALE_LABELS = {
  [FFT_SCALES.LINEAR]: "Linear Scale",
  [FFT_SCALES.LOG]: "Log Scale (Audiogram)",
};

export const DEFAULT_FFT_SCALE = FFT_SCALES.LINEAR;
