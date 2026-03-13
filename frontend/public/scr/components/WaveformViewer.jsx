import React, { useRef, useEffect } from 'react';

const WaveformViewer = ({ title, data, time, playbackTime, variant = 'input' }) => {
  const canvasRef = useRef(null);
  const strokeColor = variant === 'output' ? '#d946ef' : '#3b82f6';

  useEffect(() => {
    if (!data || !time) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const step = Math.floor(data.length / width) || 1;
    const scale = (Math.max(...data.map(Math.abs)) || 1) * 1.1;
    const half = height / 2;

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i++) {
      const idx = Math.min(i * step, data.length - 1);
      const y = half - (data[idx] / scale) * (half - 4);
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    if (playbackTime > 0 && time.length > 0) {
      const maxTime = time[time.length - 1];
      const cursorX = (playbackTime / maxTime) * width;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
    }
  }, [data, time, playbackTime, strokeColor]);

  return (
    <div>
      <h3>{title}</h3>
      <canvas ref={canvasRef} width={600} height={180} />
    </div>
  );
};

export default WaveformViewer;