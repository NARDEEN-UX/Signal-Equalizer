import React, { useEffect, useRef, useState, useCallback } from "react";
import Plot from "react-plotly.js";
import "../CSS_files/time.css";
import {
  SPEED_OPTIONS,
  DEFAULT_SPEED,
  formatTime,
  AUDIO_CONFIG,
  PLOT_STYLE,
  BUTTON_LABELS,
} from "../utils/audioControls";

const { darkColor, purpleColor, redColor, axisColor } = PLOT_STYLE;

// Helper functions for array operations
const getArrayStats = (array) => {
  if (!array || array.length === 0) return { min: 0, max: 0, maxAbs: 0 };
  
  let min = array[0];
  let max = array[0];
  let maxAbs = Math.abs(array[0]);
  
  for (let i = 1; i < array.length; i++) {
    const value = array[i];
    const absValue = Math.abs(value);
    
    if (value < min) min = value;
    if (value > max) max = value;
    if (absValue > maxAbs) maxAbs = absValue;
  }
  
  return { min, max, maxAbs };
};

// WAV file writer helper
const writeWavHeader = (view, dataSize, sampleRate) => {
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
};

export default function Time({ 
  title = "Audio Waveform", 
  audioFile, 
  themeColor = purpleColor,
  type = "input",
  outputData = null,
  onOutputDataUpdate = null,
  sharedXRange = null,
  onXRangeChange = null,
  // NEW: Props for synchronized currentTime (red line)
  sharedCurrentTime = null,
  onCurrentTimeChange = null,
  // NEW: Props for synchronized finished state
  sharedHasFinished = false,
  onFinishedChange = null
}) {
  const audioRef = useRef(null);
  const plotRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_SPEED);
  const [hasFinished, setHasFinished] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [timeData, setTimeData] = useState([]);
  const [amplitudeData, setAmplitudeData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reset all state to initial values
  const resetState = useCallback(() => {
    setTimeData([]);
    setAmplitudeData([]);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setHasFinished(false);
    setAudioUrl(null);
  }, []);

  // Convert amplitude data to WAV URL (frontend)
  const createWavUrl = useCallback((amplitudes, sampleRate) => {
    try {
      if (!amplitudes || amplitudes.length === 0) {
        console.warn("No amplitude data provided");
        return null;
      }

      const { maxAbs } = getArrayStats(amplitudes);
      const normalizer = maxAbs > 1 ? maxAbs : 1;

      const bytesPerSample = 2; // 16-bit
      const dataSize = amplitudes.length * bytesPerSample;
      const bufferSize = 44 + dataSize;

      const buffer = new ArrayBuffer(bufferSize);
      const view = new DataView(buffer);

      writeWavHeader(view, dataSize, sampleRate);

      // Write audio samples
      let offset = 44;
      for (let i = 0; i < amplitudes.length; i++) {
        const sample = Math.max(-1, Math.min(1, amplitudes[i] / normalizer));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }

      const blob = new Blob([buffer], { type: "audio/wav" });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Error creating WAV:", error);
      return null;
    }
  }, []);

  // Process audio file and extract waveform data
  const processAudioFile = useCallback(async (file) => {
    setIsLoading(true);
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const step = Math.floor(rawData.length / AUDIO_CONFIG.targetPoints);
      
      const times = [];
      const amplitudes = [];
      
      for (let i = 0; i < rawData.length; i += step) {
        times.push(i / sampleRate);
        amplitudes.push(rawData[i]);
      }
      
      setTimeData(times);
      setAmplitudeData(amplitudes);
      setDuration(audioBuffer.duration);
    } catch (error) {
      console.error("Error processing audio:", error);
      alert("Error processing audio");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup audio event listeners
  const setupAudioListeners = useCallback((audio) => {
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => {
      setIsPlaying(true);
      setHasFinished(false);
      if (onFinishedChange) onFinishedChange(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setHasFinished(true);
      if (onFinishedChange) onFinishedChange(true);
    };

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onFinishedChange]);

  // Handle input audio file
  useEffect(() => {
    if (audioFile && type === "input") {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      processAudioFile(audioFile);

      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile, type, processAudioFile]);

  // Handle output data display
  useEffect(() => {
    console.log(`[${type}] Output data changed:`, outputData); // Debug log
    if (type === "output") {
      if (outputData) {
        setTimeData(outputData.time || []);
        setAmplitudeData(outputData.amplitude || []);
        if (outputData.duration) {
          setDuration(outputData.duration);
        }
        
        const sampleRate = outputData.sample_rate || 44100;
        const amplitudes = outputData.amplitude || [];
        const wavUrl = createWavUrl(amplitudes, sampleRate);
        setAudioUrl(wavUrl);
        console.log("Output audio WAV created on frontend");
      } else {
        resetState();
      }
    }
  }, [outputData, type, createWavUrl, resetState]);

  // Load audio when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load();
    }
  }, [audioUrl]);

  // NEW: Update current time using requestAnimationFrame AND notify parent
  useEffect(() => {
    const updateTimeLoop = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const newTime = audioRef.current.currentTime;
        setCurrentTime(newTime);
        
        // Notify parent about time change so other component can sync
        if (onCurrentTimeChange) {
          onCurrentTimeChange(newTime);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateTimeLoop);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTimeLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, onCurrentTimeChange]);

  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    return setupAudioListeners(audio);
  }, [audioUrl, setupAudioListeners]);

  // Handle Plotly zoom/pan events to sync between graphs
  const handlePlotlyRelayout = useCallback((event) => {
    console.log("Relayout event:", event); // Debug log
    
    // Check if xaxis range changed (zoom/pan)
    if (event['xaxis.range[0]'] !== undefined && event['xaxis.range[1]'] !== undefined) {
      const newRange = [event['xaxis.range[0]'], event['xaxis.range[1]']];
      console.log("Setting new range:", newRange); // Debug log
      if (onXRangeChange) {
        onXRangeChange(newRange);
      }
    }
    // Check if xaxis.range is an array (another format)
    else if (event['xaxis.range'] && Array.isArray(event['xaxis.range'])) {
      const newRange = event['xaxis.range'];
      console.log("Setting range from array:", newRange); // Debug log
      if (onXRangeChange) {
        onXRangeChange(newRange);
      }
    }
    // Check if autoscale/reset was triggered
    else if (event['xaxis.autorange'] === true) {
      console.log("Resetting range"); // Debug log
      if (onXRangeChange) {
        onXRangeChange(null);
      }
    }
  }, [onXRangeChange]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If finished (local or shared), restart from beginning
      if (hasFinished || sharedHasFinished) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        setHasFinished(false);
        if (onCurrentTimeChange) onCurrentTimeChange(0);
        if (onFinishedChange) onFinishedChange(false);
      } 
      // If there's a shared time from the other component, start from there
      else if (sharedCurrentTime !== null && sharedCurrentTime >= 0) {
        audioRef.current.currentTime = sharedCurrentTime;
        setCurrentTime(sharedCurrentTime);
      }
      
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((error) => {
          console.error("Error playing audio:", error);
          setIsPlaying(false);
        });
    }
  }, [isPlaying, hasFinished, sharedHasFinished, onCurrentTimeChange, onFinishedChange, sharedCurrentTime]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      setHasFinished(false);
      if (onFinishedChange) onFinishedChange(false);
    }
  }, [onFinishedChange]);

  const handleSpeedChange = useCallback((speed) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  }, []);

  // NEW: Determine which currentTime to display for the red line
  // If this component is playing, use local currentTime
  // Otherwise, use sharedCurrentTime from parent (synced from other component)
  const displayTime = isPlaying ? currentTime : (sharedCurrentTime !== null ? sharedCurrentTime : currentTime);
  
  // NEW: Determine if we should show "Completed" badge
  // Show it if either this component finished OR the other component finished
  const displayFinished = hasFinished || sharedHasFinished;

  // Loading state
  if (isLoading) {
    return (
      <div className="time-container">
        <h2 className="time-title">{title}</h2>
        <div style={{ textAlign: "center", padding: "40px", color: themeColor }}>
          <div style={{ 
            border: "4px solid #333",
            borderTop: "4px solid " + themeColor,
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            animation: "spin 1s linear infinite",
            margin: "0 auto 20px"
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="time-container">
      <h2 className="time-title">{title}</h2>

      {/* Audio player */}
      {audioUrl && (
        <audio ref={audioRef} className="audio-hidden">
          <source src={audioUrl} type={type === "output" ? "audio/wav" : "audio/mpeg"} />
        </audio>
      )}

      {/* Control buttons */}
      {audioUrl && (
        <>
        <div className="controls-wrapper">
        <button
          onClick={handlePlayPause}
          className="btn btn-play"
        >
          {isPlaying ? BUTTON_LABELS.pause : BUTTON_LABELS.play}
        </button>

        {type === "input" && (
          <>
            <button
              onClick={handleStop}
              className="btn btn-stop"
            >
              {BUTTON_LABELS.stop}
            </button>

            <div className="speed-controls">
              {SPEED_OPTIONS.map(speed => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`btn btn-speed ${playbackRate === speed ? 'active' : ''}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Time display - For both input and output */}
      <div className="time-display">
        {formatTime(displayTime)} / {formatTime(duration)}
        {type === "input" && <span className="speed-indicator">Speed: {playbackRate}x</span>}
        {/* {displayFinished && <span className="completed-badge">✓ Completed</span>} */}
      </div>
      </>
      )}

      {/* Waveform plot */}
      {timeData.length > 0 && amplitudeData.length > 0 && (
        <Plot
          ref={plotRef}
          data={[
            {
              x: timeData,
              y: amplitudeData,
              type: "scatter",
              mode: "lines",
              line: { color: themeColor, width: 2 },
              name: "Signal"
            },
            // NEW: Show red line while playing OR if there's a valid displayTime (not finished)
            ...((displayTime > 0 && displayTime < duration && !displayFinished) ? [{
              x: [displayTime, displayTime],
              y: (() => {
                const { min, max } = getArrayStats(amplitudeData);
                return [min, max];
              })(),
              type: "scatter",
              mode: "lines",
              line: { color: redColor, width: 2, dash: "dash" },
              name: "Current Time"
            }] : [])
          ]}
          layout={{
            plot_bgcolor: darkColor,
            paper_bgcolor: darkColor,
            font: { color: themeColor },
            xaxis: { 
              title: "Time (s)", 
              color: themeColor,
              gridcolor: PLOT_STYLE.gridColor,
              tickcolor: axisColor,
              tickfont: { color: axisColor },
              titlefont: { color: axisColor },
              showline: true,
              linecolor: axisColor,
              range: sharedXRange || undefined,
            },
            yaxis: {
              title: "Amplitude",
              color: themeColor,
              gridcolor: PLOT_STYLE.gridColor,
              tickcolor: axisColor,
              tickfont: { color: axisColor },
              titlefont: { color: axisColor },
              zeroline: true,
              zerolinecolor: PLOT_STYLE.zerolineColor,
              zerolinewidth: PLOT_STYLE.zerolineWidth,
              showline: true,
              linecolor: axisColor,
              nticks: 10,
              tickmode:'auto',
            },
            margin: { t: 40, l: 60, r: 20, b: 50 },
            showlegend: false,
            dragmode: "zoom"
          }}
          style={{ width: "100%", height: "400px" }}
          config={{ 
            responsive: true,
            scrollZoom: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
          }}
          onRelayout={handlePlotlyRelayout}
        />
      )}
    </div>
  );
}