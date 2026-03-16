/**
 * useBackendProcessing Hook
 * Handles communication with backend for signal processing
 * Supports all modes including 5-band animal mode
 * 
 * Updated: 2024
 * Version: 2.0
 */

import { useCallback, useState, useEffect } from 'react';

export const useBackendProcessing = (modeFreqConfig) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processedData, setProcessedData] = useState(null);

  /**
   * Extract gains from modeFreqConfig bands
   * Works with any number of bands (3, 4, 5, etc.)
   * 
   * @returns {Array} Array of gain values
   */
  const extractGains = useCallback(() => {
    if (!modeFreqConfig?.bands || !Array.isArray(modeFreqConfig.bands)) {
      return [];
    }

    return modeFreqConfig.bands.map((band) => band.gain || 1.0);
  }, [modeFreqConfig]);

  /**
   * Extract band names from modeFreqConfig
   * Works with any number of bands
   * 
   * @returns {Array} Array of band name strings
   */
  const extractBandNames = useCallback(() => {
    if (!modeFreqConfig?.bands || !Array.isArray(modeFreqConfig.bands)) {
      return [];
    }

    return modeFreqConfig.bands.map((band) => band.name || band.id);
  }, [modeFreqConfig]);

  /**
   * Extract frequency information from bands
   * Returns array of {id, name, low, high, gain} objects
   * 
   * @returns {Array} Array of frequency band objects
   */
  const extractFrequencyBands = useCallback(() => {
    if (!modeFreqConfig?.bands || !Array.isArray(modeFreqConfig.bands)) {
      return [];
    }

    return modeFreqConfig.bands.map((band) => ({
      id: band.id,
      name: band.name,
      low: band.low,
      high: band.high,
      gain: band.gain || 1.0
    }));
  }, [modeFreqConfig]);

  /**
   * Send audio to backend for processing
   * 
   * @param {AudioBuffer | Float32Array} audioData - Input audio data
   * @param {string} mode - Processing mode (music, animals, human, ecg, generic)
   * @returns {Promise} Processing result
   */
  const processAudio = useCallback(
    async (audioData, mode = 'animals') => {
      setLoading(true);
      setError(null);

      try {
        // Validate inputs
        if (!audioData) {
          throw new Error('No audio data provided');
        }

        if (!modeFreqConfig) {
          throw new Error('No mode configuration available');
        }

        // Convert AudioBuffer to array if needed
        let audioArray = audioData;
        if (audioData instanceof AudioBuffer) {
          audioArray = audioData.getChannelData(0);
        }

        // Prepare request payload
        const gains = extractGains();
        const bands = extractFrequencyBands();

        const payload = {
          mode: mode,
          audio: Array.from(audioArray),
          gains: gains,
          bands: bands,
          sampleRate: modeFreqConfig.sample_rate || 44100
        };

        // Send to backend
        const response = await fetch('/api/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Backend error: ${response.statusText}`);
        }

        const result = await response.json();

        // Store processed data
        setProcessedData(result);

        return result;
      } catch (err) {
        setError(err.message);
        console.error('Backend processing error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [modeFreqConfig, extractGains, extractFrequencyBands]
  );

  /**
   * Apply band-specific processing
   * 
   * @param {string} bandName - Name of band to process
   * @param {AudioBuffer} audioData - Input audio
   * @returns {Promise} Band-specific result
   */
  const processBand = useCallback(
    async (bandName, audioData) => {
      setLoading(true);
      setError(null);

      try {
        const band = modeFreqConfig?.bands?.find(
          (b) => b.name === bandName || b.id === bandName
        );

        if (!band) {
          throw new Error(`Band not found: ${bandName}`);
        }

        // Convert audio if needed
        let audioArray = audioData;
        if (audioData instanceof AudioBuffer) {
          audioArray = audioData.getChannelData(0);
        }

        const payload = {
          mode: modeFreqConfig.mode,
          band: {
            id: band.id,
            name: band.name,
            low: band.low,
            high: band.high,
            gain: band.gain
          },
          audio: Array.from(audioArray),
          sampleRate: modeFreqConfig.sample_rate || 44100
        };

        const response = await fetch('/api/process-band', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Backend error: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        setError(err.message);
        console.error('Band processing error:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [modeFreqConfig]
  );

  /**
   * Get band information from backend
   * 
   * @param {string} mode - Mode identifier
   * @returns {Promise} Band information
   */
  const getBandInfo = useCallback(async (mode = 'animals') => {
    try {
      const response = await fetch(`/api/modes/${mode}/info`);

      if (!response.ok) {
        throw new Error(`Failed to fetch band info: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Error fetching band info:', err);
      throw err;
    }
  }, []);

  /**
   * Get frequency statistics for audio
   * 
   * @param {AudioBuffer | Float32Array} audioData - Input audio
   * @returns {Promise} Frequency statistics
   */
  const getFrequencyStats = useCallback(
    async (audioData) => {
      setLoading(true);
      setError(null);

      try {
        // Convert audio if needed
        let audioArray = audioData;
        if (audioData instanceof AudioBuffer) {
          audioArray = audioData.getChannelData(0);
        }

        const payload = {
          mode: modeFreqConfig?.mode || 'animals',
          audio: Array.from(audioArray),
          sampleRate: modeFreqConfig?.sample_rate || 44100
        };

        const response = await fetch('/api/frequency-stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Failed to get stats: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        setError(err.message);
        console.error('Error getting frequency stats:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [modeFreqConfig]
  );

  /**
   * Validate band configuration
   * Ensures band array matches slider arrays
   * 
   * @returns {Object} Validation result {valid: boolean, issues: string[]}
   */
  const validateConfig = useCallback(() => {
    const issues = [];

    if (!modeFreqConfig) {
      issues.push('No mode configuration available');
      return { valid: false, issues };
    }

    const bandCount = modeFreqConfig.bands?.length || 0;
    const freqCount = modeFreqConfig.sliders_freq?.length || 0;
    const waveletCount = modeFreqConfig.sliders_wavelet?.length || 0;

    if (bandCount === 0) {
      issues.push('No bands defined');
    }

    if (bandCount !== freqCount) {
      issues.push(
        `Band count (${bandCount}) != sliders_freq count (${freqCount})`
      );
    }

    if (freqCount !== waveletCount) {
      issues.push(
        `sliders_freq count (${freqCount}) != sliders_wavelet count (${waveletCount})`
      );
    }

    // Validate each band
    modeFreqConfig.bands?.forEach((band, idx) => {
      if (!band.id) issues.push(`Band ${idx} missing id`);
      if (!band.name) issues.push(`Band ${idx} missing name`);
      if (typeof band.low !== 'number') issues.push(`Band ${idx} invalid low frequency`);
      if (typeof band.high !== 'number') issues.push(`Band ${idx} invalid high frequency`);
      if (band.low >= band.high) {
        issues.push(`Band ${idx} low frequency >= high frequency`);
      }
    });

    return {
      valid: issues.length === 0,
      issues,
      bandCount,
      freqCount,
      waveletCount
    };
  }, [modeFreqConfig]);

  return {
    // Functions
    processAudio,
    processBand,
    getBandInfo,
    getFrequencyStats,
    extractGains,
    extractBandNames,
    extractFrequencyBands,
    validateConfig,
    
    // State
    loading,
    error,
    processedData,
    
    // Methods to clear state
    clearError: () => setError(null),
    clearProcessedData: () => setProcessedData(null)
  };
};

export default useBackendProcessing;