/**
 * Modes Index
 * Central exports for all mode configurations
 * 
 * Usage:
 *   import { HUMAN_MODE_CONFIG } from '@/modes'
 *   import * as Modes from '@/modes'
 */

export { HUMAN_MODE_CONFIG } from './human/config';
export { ANIMAL_MODE_CONFIG } from './animal/config';
export { MUSIC_MODE_CONFIG } from './music/config';
export { ECG_MODE_CONFIG } from './ecg/config';
export { GENERIC_MODE_CONFIG } from './generic/config';

// Re-export services
export { humanModeService } from './human/humanService';
export { animalModeService } from './animal/animalService';
export { musicModeService } from './music/musicService';
export { ecgModeService } from './ecg/ecgService';
export { genericModeService } from './generic/genericService';
