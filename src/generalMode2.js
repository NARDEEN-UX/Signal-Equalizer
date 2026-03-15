import "./CSS_files/generic.css";
import { useNavigate } from "react-router-dom";
import { FaArrowCircleUp } from "react-icons/fa"; 
import { CiHome } from "react-icons/ci";
import { RiRobot2Line } from "react-icons/ri";
import { PiSliders } from "react-icons/pi";
import { useState, useRef, useEffect, useCallback } from "react";
import Time from "./Graphs/time";
import FFT from "./Graphs/freq";
import Spectrogram from "./Graphs/spectro";

export default function GeneralMode({
  audioFile,
  onFileChange,
  themeColor,
  outputTimeData,
  processedData,
  renderControlPanelFn = null,
  onSetMaxFrequency = () => {},
  onProcessData = () => {},
  onReconstructData = () => {},
  isProcessing = false,
  onSetProcessing = () => {},
  selectedPreset = null,
  onPresetChange = null,
  presets = [],
  autoProcessConfig = null,  //take bands
  data = [],
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [outputSpectrogramData, setOutputSpectrogramData] = useState(null);
  const debounceTimerRef = useRef(null);
  const lastParamsRef = useRef(null);
  const manualParamsRef = useRef(null);
  const [sharedCurrentTime, setSharedCurrentTime] = useState(0);
  const [sharedXRange, setSharedXRange] = useState(null);




  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      alert("Please upload an audio file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Clear output spectrogram data when new file is uploaded
      setOutputSpectrogramData(null);
      // Reset zoom when new file is uploaded
      setSharedXRange(null);
      // Reset shared time
      setSharedCurrentTime(0);
      onFileChange(file);
      const url = URL.createObjectURL(file);
      alert(`File: ${file.name} uploaded`);
    } catch (err) {
      alert(`Error in uploading: ${err.message}`);
      console.error("Upload error:", err);
    }
  };

  const predictAI = async () => {
    // Save current manual params before switching to AI
    manualParamsRef.current = autoProcessConfig?.params;
    
    setAiLoading(true);
    try {
      // Clear previous outputs (spectrogram, time, AND frequency)
      setOutputSpectrogramData(null);
      onReconstructData(null);  // Clear output time data
      onProcessData(null);      // Clear output FFT data
      
      // Select endpoint based on preset
      let endpoint = "/music_model";
      if (selectedPreset === "human") {
        endpoint = "/human_model";
      } else if (selectedPreset === "music") {
        endpoint = "/music_model";  
      }
      
      console.log(`Using ${selectedPreset || "music"} model - endpoint: ${endpoint}`);
      
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bands: data,
          save_stems: false
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`${selectedPreset || "music"} model processed:`, result.message);
                
        // 1. Compute FFT from AI output (wait for it)
        await new Promise((resolve, reject) => {
          const fftSource = new EventSource("http://localhost:5000/fft?type=output");        
          fftSource.onmessage = (event) => {
            const fftData = JSON.parse(event.data);
            if (fftData.freqs && fftData.magnitude) {
              onProcessData(fftData);
            }
          };
          
          fftSource.addEventListener("complete", () => {
            fftSource.close();
            console.log("AI FFT displayed");
            resolve();
          });
          
          fftSource.onerror = () => {
            fftSource.close();
            reject(new Error("FFT failed"));
          };
        });
        
        // 2. Get AI output for time domain + spectrogram
        console.log("About to call reconstructSignal()...");
        await reconstructSignal();
        
        console.log("AI model results displayed in all graphs");
      } else {
        console.error("Error:", result.error);
        alert(`AI Processing Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to process:", error);
      alert(`Failed to process: ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };


  // Process aLL bands 
  const processAllBands = useCallback(async (bands) => {
    try {
      console.log("Processing bands:", bands.length);

      const processResponse = await fetch("http://localhost:5000/process_all", {   //to backend(processing)
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bands }),
      });

      if (!processResponse.ok) throw new Error("Process failed");

      const processReader = processResponse.body.getReader();  // read response
      const processDecoder = new TextDecoder();
      let processBuffer = "";

      while (true) {
        const { done, value } = await processReader.read();
        if (done) break;

        processBuffer += processDecoder.decode(value, { stream: true });
        const lines = processBuffer.split("\n");
        processBuffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].startsWith("data: ")) {
            const data = JSON.parse(lines[i].slice(6));
            if (data.freqs && data.magnitude) {
              onProcessData(data);
            }
          }
        }
      }
    } catch (err) {
      console.error("Process error:", err);
      throw err;
    }
  }, [onProcessData]);

  // Reconstruct signal from modified FFT - returns Promise so we can await it
  const reconstructSignal = useCallback(() => {
    console.log("🟢 reconstructSignal called");
    return new Promise((resolve, reject) => {
      const reconstructSource = new EventSource(
        "http://localhost:5000/reconstruct"
      );

      reconstructSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.time && data.amplitude) {
          onReconstructData(data);
        }
      };

      reconstructSource.addEventListener("complete", async () => {
        reconstructSource.close();
        console.log("Reconstruction completed");
        
        // Fetch output spectrogram from backend
        try {
          const spectroResponse = await fetch("http://localhost:5000/spectrogram?type=output");
          if (spectroResponse.ok) {
            const spectroData = await spectroResponse.json();
            setOutputSpectrogramData(spectroData);
            console.log("Output spectrogram fetched successfully");
          } else {
            console.error("Failed to fetch output spectrogram:", spectroResponse.status);
          }
        } catch (err) {
          console.error("Error fetching output spectrogram:", err);
        }
        resolve(); // Done!
      });

      reconstructSource.onerror = (err) => {
        reconstructSource.close();
        reject(new Error("Reconstruction failed"));
      };
    });
  }, [onReconstructData]);

  // Process bands and reconstruct
  const processAllAndReconstruct = useCallback(async (bands) => {
    try {
      await processAllBands(bands);
      await reconstructSignal();
    } catch (err) {
      console.error("Process and reconstruct error:", err);
      throw err;
    }
  }, [processAllBands, reconstructSignal]);




  // Auto-process with debounce when config changes
  useEffect(() => {
    if (!autoProcessConfig || !audioFile) return;

    const { params, enabled } = autoProcessConfig;
    if (!enabled || !params) return;

    // Serialize params for comparison (works for both single object and array)
    const currentParams = JSON.stringify(params);
    
    // Compare with last processed params - skip if values haven't changed
    if (lastParamsRef.current === currentParams) {
      console.log("Skipping request - values unchanged");
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for 500ms debounce
    debounceTimerRef.current = setTimeout(async () => {
      // Store current params before processing
      lastParamsRef.current = currentParams;
      
      onSetProcessing(true);
      try {
        // Convert params to bands array format
        let bandsForBackend = [];
        
        if (Array.isArray(params)) {
          // Multiple bands
          bandsForBackend = params
            .filter(band => band.startFreq < band.endFreq)
            .map(band => ({
              start_freq: band.startFreq,
              end_freq: band.endFreq,
              scaling_factor: band.scalingFactor
            }));
        } else if (params && params.startFreq < params.endFreq) {
          // Single band - convert to array
          bandsForBackend = [{
            start_freq: params.startFreq,
            end_freq: params.endFreq,
            scaling_factor: params.scalingFactor
          }];
        }
        
        // Always use processAllAndReconstruct (handles empty array = reset)
        await processAllAndReconstruct(bandsForBackend);
      } catch (err) {
        console.error("Auto-process error:", err);
      } finally {
        onSetProcessing(false);
      }
    }, 500);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoProcessConfig, audioFile, processAllAndReconstruct, onSetProcessing]);

  const switchToManualMode = async () => {
    if (!audioFile || !manualParamsRef.current) {
      console.log("No saved manual params, just navigating");
      navigate("/customized");
      return;
    }

    try {
      // Re-upload the original file to reset backend state
      const formData = new FormData();
      formData.append("file", audioFile);

      await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      // Clear AI outputs
      setOutputSpectrogramData(null);
      onProcessData(null);
      onReconstructData(null);

      // Trigger re-processing with saved manual params
      const params = manualParamsRef.current;
      onSetProcessing(true);

      // Convert params to bands format for processAllAndReconstruct
      let bandsForBackend = [];
      if (Array.isArray(params)) {
        bandsForBackend = params
          .filter(band => band.startFreq < band.endFreq)
          .map(band => ({
            start_freq: band.startFreq,
            end_freq: band.endFreq,
            scaling_factor: band.scalingFactor
          }));
      } else if (params && params.startFreq < params.endFreq) {
        bandsForBackend = [{
          start_freq: params.startFreq,
          end_freq: params.endFreq,
          scaling_factor: params.scalingFactor
        }];
      }

      if (bandsForBackend.length > 0) {
        await processAllAndReconstruct(bandsForBackend);
      }

      onSetProcessing(false);
      console.log("Switched back to manual mode with previous settings");
    } catch (err) {
      console.error("Error switching to manual mode:", err);
      onSetProcessing(false);
    }
  };


  // Handler for X-axis range changes (zoom/pan synchronization)
  const handleXRangeChange = (newRange) => {
    console.log("GeneralMode: X-Range changed to:", newRange);
    setSharedXRange(newRange);
  };

  // NEW: Handler for currentTime changes (red line synchronization)
  const handleCurrentTimeChange = useCallback((time) => {
    setSharedCurrentTime(time);
  }, []);
  
  // Expose processAllAndReconstruct to child components via renderControlPanelFn
  const controlPanelWithProcessing = renderControlPanelFn
    ? typeof renderControlPanelFn === 'function'
      ? renderControlPanelFn(processAllAndReconstruct)
      : renderControlPanelFn
    : null;

  return (
    <div className="generic">
      {/* Top Navigation Bar */}
      <div className="top-navbar">
        <div className="navbar-left">
          <h2 style={{ color: themeColor, fontSize: "18px", margin: "0", paddingLeft: "20px" }}>
            Equalizer
          </h2>
        </div>

        <div className="navbar-right">
          {/* Preset Selector (for Customized mode) */}
          {selectedPreset && onPresetChange && presets.length > 0 && (
            <select
              value={selectedPreset}
              onChange={onPresetChange}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                backgroundColor: "rgba(183, 58, 205, 0.1)",
                border: "1px solid rgba(183, 58, 205, 0.3)",
                borderRadius: "4px",
                color: "#5679d9ff",
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              <option value="animal">🐾 Animal</option>
              <option value="human">👤 Human</option>
              <option value="music">🎵 Music</option>
            </select>
          )}

          {/* Upload button */}
          <div
            className="navbar-button"
            onClick={() => fileInputRef.current.click()}
            title="Upload Audio"
          >
            <FaArrowCircleUp size={28} color={themeColor} />
            <span>Upload</span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="audio/*"
            onChange={handleFileUpload}
          />

          {/* Home button */}
          <div className="navbar-button" onClick={() => navigate("/")} title="Home">
            <CiHome size={28} color={themeColor} />
            <span>Home</span>
          </div>

           {/* Manual Mode button */}
          <div className="navbar-button" onClick={switchToManualMode} title="Switch to Manual Mode">
            <PiSliders size={28} color={themeColor} />
            <span>Manual</span>
          </div>

          {/* AI Model button */}
          <div className="navbar-button" onClick={predictAI} title="Process with AI Model">
            <RiRobot2Line size={28} color={themeColor} />
            <span>{aiLoading ? "Analyzing..." : "Model"}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content-full">
        {audioFile ? (
          <>
            <div className="graphs-grid">
              {/* Column 1: Time Domain (Input & Output) */}
              <div className="graph-item graph-time-input">
                <Time
                  title="Time Domain - Input"
                  audioFile={audioFile}
                  themeColor={themeColor}
                  type="input"
                  sharedXRange={sharedXRange}
                  onXRangeChange={handleXRangeChange}
                  sharedCurrentTime={sharedCurrentTime}
                  onCurrentTimeChange={handleCurrentTimeChange}
                />
              </div>

              <div className="graph-item graph-time-output">
                <Time
                  title="Time Domain - Output"
                  themeColor={themeColor}
                  type="output"
                  outputData={outputTimeData}
                  onOutputDataUpdate={() => {}}
                  sharedXRange={sharedXRange}
                  onXRangeChange={handleXRangeChange}
                  sharedCurrentTime={sharedCurrentTime}
                  onCurrentTimeChange={handleCurrentTimeChange}
                />
              </div>

              {/* Column 2: Spectrogram (Input & Output) */}
              <div className="graph-item graph-spectro-input">
                <Spectrogram
                  title="Spectrogram - Input"
                  audioFile={audioFile}
                  themeColor={themeColor}
                  type="input"
                />
              </div>

              <div className="graph-item graph-spectro-output">
                <Spectrogram
                  title="Spectrogram - Output"
                  outputData={outputSpectrogramData}
                  themeColor={themeColor}
                  type="output"
                />
              </div>

              {/* Row 3: FFT (Full Width) */}
             <div className="graph-item graph-fft-input">
                <FFT
                  title="Frequency Domain - Input"
                  audioFile={audioFile}
                  themeColor={themeColor}
                  frequencyRange={{ start: 0, end: 20000 }}
                  scalingFactor={1}
                  processedData={null}  
                  onSetMaxFrequency={onSetMaxFrequency}
                  type="input"  // NEW
                />
              </div>
            
              <div className="graph-item graph-fft-output">
                <FFT
                  title="Frequency Domain - Output"
                  audioFile={audioFile}  // محتاجه للـ key بس
                  themeColor={themeColor}
                  frequencyRange={{ start: 0, end: 20000 }}
                  scalingFactor={1}
                  processedData={processedData}  // هنا بس الـ processed data
                  onSetMaxFrequency={onSetMaxFrequency}
                  type="output"  // NEW
                  outputData={processedData}  // NEW
                />
              </div>
            </div>

            {/* Control Panel - Custom from parent */}
            {controlPanelWithProcessing ? (
              <div className="control-panel-wrapper">
                {controlPanelWithProcessing}
              </div>
            ) : (
              <div className="empty-controls">
                <p style={{ color: themeColor }}>No control panel provided</p>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p style={{ color: themeColor, fontSize: "18px", textAlign: "center" }}>
              Upload an audio file to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}