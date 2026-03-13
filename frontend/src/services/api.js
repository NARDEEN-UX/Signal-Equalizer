/**
 * Centralized API service for backend communication
 * Each mode can have its own specific endpoints
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Generic processing request - works with all modes
 */
export const processAudio = async (audioData, modeId, sliderValues) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mode: modeId,
        sliders: sliderValues
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Processing error:', error);
    throw error;
  }
};

/**
 * Get mode information from backend
 */
export const getModeInfo = async (modeId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/modes/${modeId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch mode info: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching mode info:', error);
    throw error;
  }
};

/**
 * Save schema/preset
 */
export const saveSchema = async (modeId, schemaData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schemas/${modeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schemaData)
    });

    if (!response.ok) {
      throw new Error(`Failed to save schema: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving schema:', error);
    throw error;
  }
};

/**
 * Load schema/preset
 */
export const loadSchema = async (modeId, schemaId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/schemas/${modeId}/${schemaId}`);
    if (!response.ok) {
      throw new Error(`Failed to load schema: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading schema:', error);
    throw error;
  }
};
