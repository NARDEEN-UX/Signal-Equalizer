/**
 * Mode Index/Registry
 * Automatically routes to the correct mode service
 */

import { humanModeService } from '../modes/human/humanService';
import { animalModeService } from '../modes/animal/animalService';
import { musicModeService } from '../modes/music/musicService';
import { ecgModeService } from '../modes/ecg/ecgService';
import { genericModeService } from '../modes/generic/genericService';

const modeRegistry = {
  human: humanModeService,
  animal: animalModeService,
  music: musicModeService,
  ecg: ecgModeService,
  generic: genericModeService
};

/**
 * Get the service for a specific mode
 * @param {string} modeId - The mode identifier
 * @returns {Object} - The mode service
 */
export const getModeService = (modeId) => {
  const service = modeRegistry[modeId];
  if (!service) {
    throw new Error(`Mode service not found: ${modeId}`);
  }
  return service;
};

/**
 * Process audio with the correct mode service
 * @param {string} modeId - The mode identifier
 * @param {ArrayBuffer} audioData - The audio data
 * @param {Array<number>} sliderValues - Slider values
 * @returns {Promise<Object>} - Processed result
 */
export const processWithMode = async (modeId, audioData, sliderValues) => {
  const service = getModeService(modeId);
  return service.processAudio(audioData, sliderValues);
};

export default modeRegistry;
