
import { useState, useMemo } from "react";
import GeneralMode from "./generalMode2";

export default function Generic() {
  const [themeColor] = useState("#b73acdff");
  const [audioFile, setAudioFile] = useState(null);
  const [frequencyRange, setFrequencyRange] = useState({ start: 0, end: 20000 });
  const [scalingFactor, setScalingFactor] = useState(1);
  const [outputTimeData, setOutputTimeData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [maxFrequency, setMaxFrequency] = useState(20000);
  const [savedBands, setSavedBands] = useState([]);

  const handleFileChange = (file) => {
    setFrequencyRange({ start: 0, end: 20000 });
    setScalingFactor(1);
    setOutputTimeData(null);
    setProcessedData(null);
    setMaxFrequency(20000);
    setSavedBands([]);
    setAudioFile(file);
  };

  const handleFrequencyRangeChange = (type, value) => {
    if (type === "start" || type === "end") {
      const newRange = { ...frequencyRange, [type]: parseFloat(value) };
      if (newRange.start > newRange.end) return;
      setFrequencyRange(newRange);
    }
  };

  const handleScalingFactorChange = (value) => {
    setScalingFactor(parseFloat(value));
  };

  const handleSetMaxFrequency = (maxFreq) => {
    setMaxFrequency(maxFreq);
    if (frequencyRange.end === 20000) {
      setFrequencyRange({ ...frequencyRange, end: maxFreq });
    }
  };

  const addBand = () => {
    // Don't add if it's default state (no change)
    const isDefaultState = frequencyRange.start === 0 && 
                           frequencyRange.end === maxFrequency && 
                           scalingFactor === 1;
    if (isDefaultState) return;
    
    // Save current band
    setSavedBands([
      ...savedBands,
      {
        id: Date.now(),
        start: frequencyRange.start,
        end: frequencyRange.end,
        gain: scalingFactor
      }
    ]);
    // Reset sliders for next band
    setFrequencyRange({ start: 0, end: maxFrequency });
    setScalingFactor(1);
  };

  // Remove a saved band
  const removeBand = (bandId) => {
    setSavedBands(savedBands.filter(band => band.id !== bandId));
  };


  // Combine current working band + all saved bands for cumulative processing
  const allBands = useMemo(() => {
    const bands = [];
    
    // Add all saved bands first
    savedBands.forEach(band => {
      bands.push({
        startFreq: band.start,
        endFreq: band.end,
        scalingFactor: band.gain
      });
    });
    
    // Don't add if: full range (0 to max) AND gain is 1 (no change)
    const isDefaultState = frequencyRange.start === 0 && 
                           frequencyRange.end === maxFrequency && 
                           scalingFactor === 1;
    
    if (!isDefaultState && frequencyRange.start < frequencyRange.end) {
      bands.push({
        startFreq: frequencyRange.start,
        endFreq: frequencyRange.end,
        scalingFactor: scalingFactor
      });
    }
    
    return bands;
  }, [savedBands, frequencyRange.start, frequencyRange.end, scalingFactor, maxFrequency]);

  // Custom control panel with frequency range sliders
  const controlPanel = () => {
    return audioFile ? (
      <div className="custom-control-panel">
        <div className="frequency-range-container">
          <div className="frequency-slider-wrapper">
          <div className="frequency-input-group">
            <label className="frequency-label">Start (Hz)</label>
            <input
              type="number"
              value={frequencyRange.start}
              onChange={(e) =>
                handleFrequencyRangeChange("start", e.target.value)
              }
              className="frequency-input"
              min="0"
              max={frequencyRange.end}
            />
          </div>

          <div className="frequency-slider-group">
            <input
              type="range"
              min="0"
              max={maxFrequency}
              value={frequencyRange.start}
              onChange={(e) =>
                handleFrequencyRangeChange("start", e.target.value)
              }
              className="frequency-slider frequency-slider-start"
            />
            <input
              type="range"
              min="0"
              max={maxFrequency}
              value={frequencyRange.end}
              onChange={(e) =>
                handleFrequencyRangeChange("end", e.target.value)
              }
              className="frequency-slider frequency-slider-end"
            />
          </div>

          <div className="frequency-input-group">
            <label className="frequency-label">End (Hz)</label>
            <input
              type="number"
              value={frequencyRange.end}
              onChange={(e) =>
                handleFrequencyRangeChange("end", e.target.value)
              }
              className="frequency-input"
              min={frequencyRange.start}
              max={maxFrequency}
            />
          </div>
        </div>

        <div className="frequency-range-display">
          Selected Range:{" "}
          <span className="range-value">
            {frequencyRange.start.toFixed(0)} -{" "}
            {frequencyRange.end.toFixed(0)} Hz
          </span>
        </div>

        {frequencyRange.start < frequencyRange.end && (
          <div className="scaling-slider-wrapper">
            <label className="scaling-label">
              Gain:{" "}
              <span className="scaling-value-display">
                {scalingFactor.toFixed(2)}x
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={scalingFactor}
              onChange={(e) => handleScalingFactorChange(e.target.value)}
              className="scaling-slider"
            />
          </div>
        )}

        {/* Add Band Button + Saved Bands - Horizontal Layout */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '10px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={addBand}
            style={{
              padding: '6px 12px',
              background: 'rgba(183, 58, 205, 0.2)',
              border: '1px solid rgba(183, 58, 205, 0.5)',
              color: themeColor,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            + Add
          </button>

          {/* Saved Bands - Horizontal chips */}
          {savedBands.map((band, index) => (
            <div 
              key={band.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                background: 'rgba(183, 58, 205, 0.2)',
                borderRadius: '12px',
                fontSize: '10px',
                color: '#ccc'
              }}
            >
              <span>
                <strong style={{ color: themeColor }}>{index + 1}</strong>{' '}
                {band.start.toFixed(0)}-{band.end.toFixed(0)} | {band.gain.toFixed(1)}x
              </span>
              <button
                onClick={() => removeBand(band.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ff6666',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  lineHeight: 1
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {isProcessing && (
          <div style={{ 
            textAlign: 'center', 
            color: themeColor, 
            fontSize: '12px', 
            marginTop: '10px',
            fontWeight: 'bold'
          }}>
            Processing...
          </div>
        )}
        </div>
      </div>
    ) : null;
  };

  return (
    <GeneralMode
      audioFile={audioFile}
      onFileChange={handleFileChange}
      themeColor={themeColor}
      outputTimeData={outputTimeData}
      processedData={processedData}
      onSetMaxFrequency={handleSetMaxFrequency}
      onProcessData={setProcessedData}
      onReconstructData={setOutputTimeData}
      isProcessing={isProcessing}
      onSetProcessing={setIsProcessing}
      renderControlPanelFn={controlPanel}
      autoProcessConfig={{
        enabled: true,
        params: allBands
      }}
    />
  );
}