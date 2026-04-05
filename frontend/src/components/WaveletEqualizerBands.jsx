import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  getLevelsForBand,
  getAverageGain,
  applyGainToLevels,
  formatFrequency,
  createBandToLevelMap
} from '../utils/waveletMath';
import { getModeBands } from '../config/modeWaveletConfig';

/**
 * WaveletEqualizerBands
 * 
 * A dynamic UI component that renders user-friendly sliders for wavelet-based equalization.
 * Each slider represents a frequency band and controls multiple underlying wavelet levels.
 *
 * Features:
 * - Automatically calculates which wavelet levels overlap with each frequency band
 * - Updates in real-time when wavelet type or sample rate changes
 * - Shows which levels are being controlled by each slider (e.g., "Controls L3, L4")
 * - Smooth slider interaction with debounced backend updates
 *
 * Props:
 *   @param {string} currentMode - Active mode ID (e.g., 'music', 'animals', 'ecg')
 *   @param {array} waveletSliders - Current wavelet level gain values [L1, L2, L3, ...]
 *   @param {number} maxWaveletLevel - Maximum decomposition level available
 *   @param {number} sampleRate - Audio sample rate in Hz
 *   @param {function} onChange - Callback when slider changes, receives updated waveletSliders array
 *
 * Example Usage:
 *   <WaveletEqualizerBands
 *     currentMode="animals"
 *     waveletSliders={[1.0, 1.0, 1.0, 1.0, 1.0, 1.0]}
 *     maxWaveletLevel={6}
 *     sampleRate={44100}
 *     onChange={(newSliders) => setWaveletSliders(newSliders)}
 *   />
 */
const WaveletEqualizerBands = ({
  currentMode,
  waveletSliders,
  maxWaveletLevel,
  sampleRate,
  onChange
}) => {
  // Get band configuration for current mode
  const bands = getModeBands(currentMode);

  if (!bands || bands.length === 0) {
    return (
      <div className="chart-wrap" style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
        No wavelet bands configured for this mode
      </div>
    );
  }

  const sr = Math.max(1, Number(sampleRate) || 44100);
  const maxLevel = Math.max(1, Math.min(Number(maxWaveletLevel) || 6, 20));

  // Create band-to-level mapping (memoized, recalculates when wavelet/sample rate changes)
  const bandToLevelMap = useMemo(() => {
    return createBandToLevelMap(bands, maxLevel, sr);
  }, [bands, maxLevel, sr]);

  // Local state for smooth slider interaction
  const [localValues, setLocalValues] = useState(() => {
    return bands.map((band, idx) => {
      const levels = bandToLevelMap[idx] || [];
      return getAverageGain(waveletSliders, levels);
    });
  });

  const commitRafRef = useRef(null);
  const pendingCommitRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Sync local state when external waveletSliders change
  useEffect(() => {
    if (isDraggingRef.current) return; // Don't update while user is dragging
    
    setLocalValues(
      bands.map((band, idx) => {
        const levels = bandToLevelMap[idx] || [];
        return getAverageGain(waveletSliders, levels);
      })
    );
  }, [waveletSliders, bandToLevelMap, bands.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (commitRafRef.current) {
        cancelAnimationFrame(commitRafRef.current);
      }
    };
  }, []);

  /**
   * Commit slider change to parent component
   * Applies the new gain to all levels controlled by this band
   */
  const commit = (bandIndex, newGain) => {
    const band = bands[bandIndex];
    const levels = bandToLevelMap[bandIndex];

    if (Number.isFinite(band?.low) && Number.isFinite(band?.high) && Array.isArray(levels)) {
      // Convert from 1-based level numbers to 0-based array indices
      const levelIndices = levels.map(lvl => lvl - 1);
      const updatedSliders = applyGainToLevels(waveletSliders, levelIndices, newGain);
      onChange(updatedSliders);
    }
  };

  /**
   * Schedule a commit using requestAnimationFrame to debounce rapid updates
   */
  const scheduleCommit = (bandIndex, newGain) => {
    pendingCommitRef.current = { bandIndex, newGain };

    if (commitRafRef.current) {
      return; // Already scheduled
    }

    commitRafRef.current = requestAnimationFrame(() => {
      const latest = pendingCommitRef.current;
      if (latest) {
        commit(latest.bandIndex, latest.newGain);
      }
      pendingCommitRef.current = null;
      commitRafRef.current = null;
    });
  };

  /**
   * Handle slider input changes
   * Updates local state immediately, schedules commit to parent
   */
  const handleChange = (bandIndex, newVal) => {
    const val = Math.max(0, Math.min(2, parseFloat(newVal) || 1));
    const updated = [...localValues];
    updated[bandIndex] = val;
    setLocalValues(updated);
    scheduleCommit(bandIndex, val);
  };

  /**
   * Flush any pending commits when user releases slider
   */
  const flushCommit = () => {
    if (commitRafRef.current) {
      cancelAnimationFrame(commitRafRef.current);
      commitRafRef.current = null;
    }
    if (pendingCommitRef.current) {
      const { bandIndex, newGain } = pendingCommitRef.current;
      commit(bandIndex, newGain);
      pendingCommitRef.current = null;
    }
  };

  /**
   * Render the complete UI
   */
  return (
    <div className="wavelet-equalizer-bands" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {bands.map((band, bandIdx) => {
        const hasFreqRange = Number.isFinite(band.low) && Number.isFinite(band.high);

        // Skip bands without frequency range
        if (!hasFreqRange) {
          return null;
        }

        const levels = bandToLevelMap[bandIdx] || [];
        const val = Number.isFinite(localValues[bandIdx]) ? localValues[bandIdx] : 1.0;
        const freqRangeText = `${formatFrequency(band.low)} - ${formatFrequency(band.high)}`;
        const levelsText = levels.length > 0 ? levels.join(', ') : 'None';

        return (
          <div key={band.id} className="wavelet-band-slider" style={bandSliderStyle}>
            {/* Band Header: Name and Gain Value */}
            <div style={sliderRowStyle}>
              <label style={labelStyle} title={band.name}>
                {band.name}
              </label>
              <span style={gainValueStyle}>{val.toFixed(2)}×</span>
            </div>

            {/* Frequency Range and Levels Info */}
            <div style={bandInfoStyle}>
              <span style={freqRangeStyle}>{freqRangeText}</span>
              <span style={levelsInfoStyle} title={`This slider controls wavelet levels: ${levelsText}`}>
                Levels: {levelsText}
              </span>
            </div>

            {/* Slider Track and Input */}
            <div className="slider-track-wrap" style={{ ...sliderTrackWrapStyle, '--val': val }}>
              <div className="slider-track-fill" style={sliderTrackFillStyle} />
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={val}
                onPointerDown={() => {
                  isDraggingRef.current = true;
                }}
                onPointerUp={() => {
                  isDraggingRef.current = false;
                  flushCommit();
                }}
                onMouseUp={flushCommit}
                onTouchEnd={flushCommit}
                onChange={(e) => handleChange(bandIdx, e.target.value)}
                aria-label={`${band.name} wavelet gain slider (controls ${levelsText})`}
                style={sliderInputStyle}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * CSS-in-JS styles for the component
 * Structured for easy customization
 */
const bandSliderStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  padding: '0.6rem 0.8rem',
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  transition: 'background-color 0.2s'
};

const sliderRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem'
};

const labelStyle = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#e0e0e0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const gainValueStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#6366f1',
  minWidth: '35px',
  textAlign: 'right'
};

const bandInfoStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.7rem'
};

const freqRangeStyle = {
  color: '#9ca3af',
  fontWeight: 500
};

const levelsInfoStyle = {
  color: '#6b7280',
  fontStyle: 'italic',
  cursor: 'help'
};

const sliderTrackWrapStyle = {
  position: 'relative',
  height: '28px',
  display: 'flex',
  alignItems: 'center'
};

const sliderTrackFillStyle = {
  position: 'absolute',
  height: '4px',
  background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.6) 100%)',
  borderRadius: '2px',
  left: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 'calc(var(--val, 0.5) * 100%)',
  transition: 'width 0.05s linear'
};

const sliderInputStyle = {
  position: 'relative',
  width: '100%',
  height: '28px',
  appearance: 'none',
  background: 'transparent',
  cursor: 'pointer',
  zIndex: 5
};

export default WaveletEqualizerBands;
