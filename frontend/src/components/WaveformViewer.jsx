import React, { useRef, useEffect } from 'react';

const WaveformViewer = ({
  title,
  data,
  time,
  playbackTime,
  viewWindow = { start: 0, end: 1 },
  variant = 'input',
  isPlaying,
  onPlay,
  onPause,
  onStop,
  playbackRate = 1,
  onSpeedChange,
  volume = 1,
  onVolumeChange,
  onZoomIn,
  onZoomOut,
  onPanLeft,
  onPanRight,
  onResetView
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = React.useState(800);
  const strokeColor = variant === 'output' ? '#3e0c07' : '#531009';

  useEffect(() => {
    // Measure container and set canvas width
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      if (width > 0) {
        setCanvasWidth(width);
      }
    }

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          setCanvasWidth(width);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !time || !Array.isArray(data) || data.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const len = data.length;
    const startIdx = Math.floor((viewWindow.start ?? 0) * len);
    const endIdx = Math.min(len, Math.ceil((viewWindow.end ?? 1) * len));
    const sliceLen = endIdx - startIdx;
    if (sliceLen <= 0) return;

    const drawData = data.slice(startIdx, endIdx);
    const drawTime = time.slice(startIdx, endIdx);
    const t0 = drawTime[0];
    const t1 = drawTime[drawTime.length - 1];
    const timeSpan = t1 - t0 || 1e-6;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    let maxVal = 0;
    for (let i = 0; i < drawData.length; i++) {
      const v = Math.abs(drawData[i]);
      if (v > maxVal) maxVal = v;
    }
    const step = Math.floor(drawData.length / width) || 1;
    const scale = (maxVal || 1) * 1.1;
    const half = height / 2;

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i++) {
      const idx = Math.min(i * step, drawData.length - 1);
      const y = half - (drawData[idx] / scale) * (half - 4);
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    if (playbackTime >= t0 && playbackTime <= t1 && timeSpan > 0) {
      const cursorX = ((playbackTime - t0) / timeSpan) * width;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
    }
  }, [data, time, playbackTime, viewWindow, strokeColor, canvasWidth]);

  return (
    <div className="viewer-inner">
      <div className="viewer-head">
        <div className="viewer-title">{title}</div>
        <div className="viewer-toolbar" aria-label="Viewer controls">
          <button type="button" className="tool-btn" onClick={onStop} title="Stop">⏹</button>
          {isPlaying ? (
            <button type="button" className="tool-btn" onClick={onPause} title="Pause">⏸</button>
          ) : (
            <button type="button" className="tool-btn tool-btn-primary" onClick={onPlay} title="Play">▶</button>
          )}

          <div className="tool-group">
            <span className="tool-pill" title="Volume">{Number(volume).toFixed(1)}</span>
            <input
              type="range"
              className="tool-slider"
              min="0"
              max="2"
              step="0.1"
              value={volume}
              onChange={(e) => onVolumeChange?.(e.target.value)}
              title="Volume"
            />
          </div>

          <div className="tool-group">
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                type="button"
                className={`tool-chip ${Number(playbackRate) === s ? 'active' : ''}`}
                onClick={() => onSpeedChange?.(s)}
                title={`Speed ${s}x`}
              >
                {s}×
              </button>
            ))}
          </div>

          <div className="tool-group">
            <button type="button" className="tool-btn" onClick={onZoomOut} title="Zoom out">－</button>
            <button type="button" className="tool-btn" onClick={onZoomIn} title="Zoom in">＋</button>
            <button type="button" className="tool-btn" onClick={onPanLeft} title="Pan left">⟵</button>
            <button type="button" className="tool-btn" onClick={onPanRight} title="Pan right">⟶</button>
            <button type="button" className="tool-btn" onClick={onResetView} title="Reset view">↺</button>
          </div>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%' }}>
        <canvas 
          ref={canvasRef} 
          width={canvasWidth} 
          height={300}
          style={{ width: '100%', height: '300px', display: 'block' }}
        />
      </div>
    </div>
  );
};

export default WaveformViewer;
