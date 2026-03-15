import { useState, useEffect, useRef, useMemo, useContext } from "react";
import GeneralMode from "./generalMode2";
import animalData from "./components/animal_equalizer.json";
import humanData from "./components/human_equalizer.json";
import musicData from "./components/music_equalizer.json";
import { AppStateContext } from "./AppStateContext";
import "./CSS_files/generic.css";
const configPresets = {
   music: musicData,
  animal: animalData,
  human: humanData,
 
};

export default function Customized() {
  const [themeColor] = useState("#5a7fb4ff");
  const { customizedState, updateCustomizedState } = useContext(AppStateContext);
  
  // Initialize state from context or use defaults
  const [audioFile, setAudioFile] = useState(customizedState.audioFile);
  const [data, setData] = useState(customizedState.data);
  const [selectedPreset, setSelectedPreset] = useState(customizedState.selectedPreset);
  const [scalingBands, setScalingBands] = useState(customizedState.scalingBands);
  const [outputTimeData, setOutputTimeData] = useState(customizedState.outputTimeData);
  const [processedData, setProcessedData] = useState(customizedState.processedData);
  const [maxFrequency, setMaxFrequency] = useState(customizedState.maxFrequency);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const saveConfigTimerRef = useRef(null);

  // Load default data from JSON on mount or when preset changes
  useEffect(() => {
    loadBandsFromData(configPresets[selectedPreset]);
  }, [selectedPreset]);

  // Save state to context whenever it changes
  useEffect(() => {
    updateCustomizedState({
      audioFile,
      data,
      selectedPreset,
      scalingBands,
      outputTimeData,
      processedData,
      maxFrequency,
    });
  }, [audioFile, data, selectedPreset, scalingBands, outputTimeData, processedData, maxFrequency, updateCustomizedState]);

  const loadBandsFromData = (data) => {
    try {
      if (data && data.bands && Array.isArray(data.bands)) {
        setData(data.bands);
        const initialBands = {};
        data.bands.forEach((band) => {
          initialBands[band.name.toLowerCase()] = band.factor;
        });
        setScalingBands(initialBands);
      }
    } catch (err) {
      console.error("Error loading bands data:", err);
    }
  };

  const handlePresetChange = (e) => {
    const preset = e.target.value;
    setSelectedPreset(preset);
    // Reset audio when changing preset
    setAudioFile(null);
    setOutputTimeData(null);
    setProcessedData(null);
  };

  const handleFileChange = (file) => {
    const resetBands = {};
    data.forEach((jdata) => {
      resetBands[jdata.name.toLowerCase()] = jdata.factor;
    });
    setScalingBands(resetBands);
    setOutputTimeData(null);
    setProcessedData(null);
    setAudioFile(file);
  };

  const handleBandGainChange = (dataKey, value) => {
    const gainValue = parseFloat(value);
    setScalingBands((prev) => ({
      ...prev,
      [dataKey]: gainValue,
    }));
    
    // Update the factor in the data array
    setData((prev) => {
      const updated = prev.map((band) =>
        band.name.toLowerCase() === dataKey
          ? { ...band, factor: gainValue }
          : band
      );
      
      // Debounced auto-save to backend
      if (saveConfigTimerRef.current) {
        clearTimeout(saveConfigTimerRef.current);
      }
      
      saveConfigTimerRef.current = setTimeout(() => {
        fetch("http://localhost:5000/save-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preset: selectedPreset,
            data: { bands: updated },
          }),
        }).catch((err) => console.error("Auto-save failed:", err));
      }, 1000); // Save 1 second after user stops moving slider
      
      return updated;
    });
  };

  // Create band parameters array for auto-processing
  const bandParams = useMemo(() => {
    if (data.length === 0) return [];
    
    return data.map(band => {
      const bandKey = band.name.toLowerCase();
      const gain = scalingBands[bandKey] !== undefined ? scalingBands[bandKey] : 1;
      const range = band.ranges[0];
      return {
        startFreq: range?.low || 0,
        endFreq: range?.high || 0,
        scalingFactor: gain
      };
    });
  }, [data, scalingBands]);

  // Custom control panel with dynamic sliders
  const customControlPanel = (processAndReconstruct) =>
    audioFile && (
      <div className="custom-control-panel">
        <div 
          className="equalizer-bands-horizontal"
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "flex-start",
            gap: "15px",
            flexWrap: "wrap",
            padding: "20px",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            borderRadius: "8px",
          }}
        >
          {data.map((band) => {
            const bandKey = band.name.toLowerCase();
            const gain = scalingBands[bandKey] !== undefined ? scalingBands[bandKey] : 1;
            const range = band.ranges[0];


//__________________________________________________________________________
            return (
              <div 
                key={band.name} 
                className="band-slider-horizontal"
                style={{
                  flex: "1 1 20%",
                  minWidth: "80px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <label className="band-label-horizontal">
                  <span className="band-name">{band.name}</span>
                  {range && (
                    <span className="band-freq">
                      {range.low}-{range.high} Hz
                    </span>
                  )}
                </label>

                <div 
                  className="slider-with-value"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    height: "100px",
                  }}
                >
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={gain}
                    onChange={(e) =>
                      handleBandGainChange(bandKey, e.target.value)
                    }
                    className="band-slider-input-horizontal"
                    disabled={isProcessing}
                    style={{
                      width: "6px",
                      height: "80px",
                      writingMode: "bt-lr",
                      WebkitAppearance: "slider-vertical",
                      appearance: "slider-vertical",
                      cursor: "pointer",
                      accentColor: "#87CEEB",
                    }}
                  />
                  <span className="band-gain-value-horizontal">
                    {gain.toFixed(1)}x
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div style={{ 
            textAlign: 'center', 
            color: themeColor, 
            fontSize: '12px', 
            marginTop: '15px',
            fontWeight: 'bold',
            padding: '10px',
            background: 'rgba(90, 127, 180, 0.1)',
            borderRadius: '6px'
          }}>
            Processing...
          </div>
        )}
      </div>
    );

  return (
    <GeneralMode
      audioFile={audioFile}
      onFileChange={handleFileChange}
      themeColor={themeColor}
      outputTimeData={outputTimeData}
      processedData={processedData}
      onSetMaxFrequency={setMaxFrequency}
      onProcessData={setProcessedData}
      onReconstructData={setOutputTimeData}
      isProcessing={isProcessing}
      onSetProcessing={setIsProcessing}
      renderControlPanelFn={customControlPanel}
      selectedPreset={selectedPreset}
      onPresetChange={handlePresetChange}
      presets={Object.keys(configPresets)}
      autoProcessConfig={{
        enabled: true,
        params: bandParams
      }}
      data ={data}
    />
  );
}