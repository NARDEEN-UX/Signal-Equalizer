/**
 * Generic Mode Backend Service
 * 
 * Add your Generic mode specific API endpoints here
 * Example: custom band processing, flexible frequency handling, etc.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const genericModeService = {
  /**
   * Process audio with custom/generic frequency bands
   * @param {ArrayBuffer} audioData - The audio data
   * @param {Array<Object>} bands - Custom frequency bands
   * @param {Array<number>} sliderValues - Slider values [0-1]
   * @returns {Promise<Object>} - Processed audio data
   */
  processAudio: async (audioData, bands, sliderValues) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/modes/generic/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioData, bands, sliders: sliderValues })
      });
      return await response.json();
    } catch (error) {
      console.error('Generic mode processing error:', error);
      throw error;
    }
  },

  // Add more Generic mode specific methods here
  validateBands: async (bands) => {
    // TODO: Implement band validation endpoint
  }
};
