/**
 * Animal Mode Backend Service
 * Team member: @animal-mode-dev
 * 
 * Add your Animal mode specific API endpoints here
 * Example: sound classification, species identification, etc.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const animalModeService = {
  /**
   * Process audio for animal sound separation
   * @param {ArrayBuffer} audioData - The audio data
   * @param {Array<number>} sliderValues - Slider values [0-1]
   * @returns {Promise<Object>} - Processed audio data
   */
  processAudio: async (audioData, sliderValues) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/modes/animals/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioData, sliders: sliderValues })
      });
      return await response.json();
    } catch (error) {
      console.error('Animal mode processing error:', error);
      throw error;
    }
  },

  // Add more Animal mode specific methods here
  classifyAnimalSounds: async (audioData) => {
    // TODO: Implement animal sound classification endpoint
  },

  identifySpecies: async (audioData) => {
    // TODO: Implement species identification endpoint
  }
};
