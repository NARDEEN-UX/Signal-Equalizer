/**
 * ECG Mode Backend Service
 * Team member: @ecg-mode-dev
 * 
 * Add your ECG mode specific API endpoints here
 * Example: abnormality detection, rhythm analysis, etc.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const ecgModeService = {
  /**
   * Process ECG signal for abnormality detection
   * @param {ArrayBuffer} ecgData - The ECG signal data
   * @param {Array<number>} sliderValues - Slider values [0-1]
   * @returns {Promise<Object>} - Processed ECG data
   */
  processAudio: async (ecgData, sliderValues) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/modes/ecg/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: ecgData, sliders: sliderValues })
      });
      return await response.json();
    } catch (error) {
      console.error('ECG mode processing error:', error);
      throw error;
    }
  },

  // Add more ECG mode specific methods here
  detectAbnormalities: async (ecgData) => {
    // TODO: Implement abnormality detection endpoint
  },

  analyzeRhythm: async (ecgData) => {
    // TODO: Implement rhythm analysis endpoint
  }
};
