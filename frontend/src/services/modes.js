/**
 * Services Index
 * Centralized exports for all mode-specific services
 * 
 * Usage:
 *   import { humanModeService } from '@/services/modes'
 *   import { humanModeService, animalModeService } from '@/services/modes'
 */

export { humanModeService } from '../modes/human/humanService';
export { animalModeService } from '../modes/animal/animalService';
export { musicModeService } from '../modes/music/musicService';
export { ecgModeService } from '../modes/ecg/ecgService';
export { genericModeService } from '../modes/generic/genericService';

// Generic API service for all modes
export * from './api';
