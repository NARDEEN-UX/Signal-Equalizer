import React, { useEffect, useRef, useState } from "react";
import Plot from "react-plotly.js";
import "../CSS_files/time.css";

const darkColor = "#1e1e1e";
const purpleColor = "#b73acd";

export default function Time({ title, timeData, amplitudeData, audioSrc }) {
  const audioRef = useRef(null);
  const plotRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [xRange, setXRange] = useState(null);
  const [hasFinished, setHasFinished] = useState(false);

  // تشغيل الصوت أوتوماتيك عند التحميل
  useEffect(() => {
    if (audioRef.current && audioSrc) {
      audioRef.current.load();
      audioRef.current.play().catch((error) => {
        console.log("Autoplay prevented:", error);
      });
    }
  }, [audioSrc]);

  // تحديث الوقت الحالي
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setHasFinished(true);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioSrc]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (hasFinished) {
          audioRef.current.currentTime = 0;
          setCurrentTime(0);
          setHasFinished(false);
        }
        audioRef.current.play();
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      setHasFinished(false);
    }
  };

  const handleSpeedChange = (speed) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  };

  const handleZoomIn = () => {
    const range = xRange || [0, Math.max(...timeData)];
    const center = (range[0] + range[1]) / 2;
    const newWidth = (range[1] - range[0]) * 0.5;
    setXRange([center - newWidth / 2, center + newWidth / 2]);
  };

  const handleZoomOut = () => {
    const range = xRange || [0, Math.max(...timeData)];
    const center = (range[0] + range[1]) / 2;
    const newWidth = (range[1] - range[0]) * 2;
    setXRange([
      center - newWidth / 2,
      center + newWidth / 2
    ]);
  };

  const handleReset = () => {
    setXRange(null);
    setPlaybackRate(1);
    if (audioRef.current) {
      audioRef.current.playbackRate = 1;
    }
  };

  // البيانات المعروضة
  const showFullSignal = hasFinished || currentTime >= duration - 0.1;
  
  const visibleData = timeData.map((t, i) => ({
    time: t,
    amplitude: (t <= currentTime || showFullSignal) ? amplitudeData[i] : null
  }));

  const displayTimeData = visibleData.map(d => d.time);
  const displayAmplitudeData = visibleData.map(d => d.amplitude);

  return (
    <div className="time-container">
      <h2 className="time-title">{title}</h2>

      {/* مشغل الصوت */}
      {audioSrc && (
        <audio ref={audioRef} className="audio-hidden">
          <source src={audioSrc} type="audio/mpeg" />
        </audio>
      )}

      {/* أدوات التحكم */}
      <div className="controls-wrapper">
        <button
          onClick={handlePlayPause}
          className="btn btn-play"
        >
          {isPlaying ? "⏸ Pause" : hasFinished ? "🔄 Replay" : "▶ Play"}
        </button>

        <button
          onClick={handleStop}
          className="btn btn-stop"
        >
          ⏹ Stop
        </button>

        <div className="speed-controls">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`btn btn-speed ${playbackRate === speed ? 'active' : ''}`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <button
          onClick={handleZoomIn}
          className="btn btn-zoom"
        >
          🔍+ Zoom In
        </button>

        <button
          onClick={handleZoomOut}
          className="btn btn-zoom"
        >
          🔍- Zoom Out
        </button>

        <button
          onClick={handleReset}
          className="btn btn-reset"
        >
          🔄 Reset
        </button>
      </div>

      {/* شريط الوقت */}
      <div className="time-display">
        {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / 
        {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
        <span className="speed-indicator">Speed: {playbackRate}x</span>
        {hasFinished && <span className="completed-badge">✓ Completed</span>}
      </div>

      {/* الجراف */}
      <Plot
        ref={plotRef}
        data={[
          {
            x: displayTimeData,
            y: displayAmplitudeData,
            type: "scatter",
            mode: "lines",
            line: { color: purpleColor, width: 2 },
            name: "Signal"
          },
          ...(isPlaying || (currentTime > 0 && !hasFinished) ? [{
            x: [currentTime, currentTime],
            y: [Math.min(...amplitudeData), Math.max(...amplitudeData)],
            type: "scatter",
            mode: "lines",
            line: { color: "#ff6b6b", width: 2, dash: "dash" },
            name: "Current Time"
          }] : [])
        ]}
        layout={{
          plot_bgcolor: darkColor,
          paper_bgcolor: darkColor,
          font: { color: purpleColor },
          xaxis: { 
            title: "Time (s)", 
            color: purpleColor,
            gridcolor: "#333",
            range: xRange || [0, Math.max(...timeData)]
          },
          yaxis: {
            title: "Amplitude",
            color: purpleColor,
            gridcolor: "#333",
            zeroline: true,
            zerolinecolor: "#555",
            zerolinewidth: 1
          },
          margin: { t: 40, l: 60, r: 20, b: 50 },
          showlegend: false,
          dragmode: "pan"
        }}
        style={{ width: "100%", height: "400px" }}
        config={{ 
          responsive: true,
          scrollZoom: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d']
        }}
      />
    </div>
  );
}