import React, { useRef, useEffect } from 'react';

const SpectrogramViewer = ({ title, times, freqs, magnitudes }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = React.useState(800);

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
    if (!times || !freqs || !magnitudes) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const flat = Array.isArray(magnitudes) ? magnitudes.flat?.() ?? magnitudes : [];
    let maxVal = 1e-8;
    for (let i = 0; i < flat.length; i++) {
      const v = Number(flat[i]);
      if (!Number.isNaN(v) && v > maxVal) maxVal = v;
    }
    const imageData = ctx.createImageData(width, height);

    for (let x = 0; x < width; x++) {
      const tIdx = Math.floor((x / width) * times.length);
      for (let y = 0; y < height; y++) {
        const fIdx = Math.floor((y / height) * freqs.length);
        const row = Array.isArray(magnitudes[fIdx]) ? magnitudes[fIdx] : magnitudes;
        const val = (typeof row === 'object' && row[tIdx] != null) ? row[tIdx] : 0;
        const gray = Math.floor(255 * (val / maxVal));
        const idx = (y * width + x) * 4;
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [times, freqs, magnitudes, canvasWidth]);

  return (
    <div>
      {title && <h4>{title}</h4>}
      <div ref={containerRef} style={{ width: '100%' }}>
        <canvas 
          ref={canvasRef} 
          width={canvasWidth} 
          height={280}
          style={{ width: '100%', height: '280px', display: 'block' }}
        />
      </div>
    </div>
  );
};

export default SpectrogramViewer;
