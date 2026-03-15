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

    const flat = Array.isArray(magnitudes) ? (magnitudes.flat ? magnitudes.flat() : magnitudes) : [];
    let maxVal = 1e-8;
    for (let i = 0; i < flat.length; i += 1) {
      const v = Number(flat[i]);
      if (!Number.isNaN(v) && v > maxVal) maxVal = v;
    }
    const invMax = 1 / maxVal;
    const imageData = ctx.createImageData(width, height);

    for (let x = 0; x < width; x += 1) {
      const tIdx = Math.min(times.length - 1, Math.floor((x / width) * times.length));
      for (let y = 0; y < height; y += 1) {
        // Flip vertically so low frequencies are at the bottom
        const yNorm = y / height;
        const fIdx = Math.min(
          freqs.length - 1,
          Math.floor((1 - yNorm) * freqs.length)
        );
        const row = Array.isArray(magnitudes[fIdx]) ? magnitudes[fIdx] : magnitudes;
        const raw = (typeof row === 'object' && row[tIdx] != null) ? Number(row[tIdx]) : 0;
        const v = raw > 0 ? raw * invMax : 0;
        // Log-like contrast curve for dark theme
        const gamma = 0.4;
        const boosted = Math.pow(Math.min(1, Math.max(0, v)), gamma);
        const gray = Math.floor(35 + 215 * boosted); // keep a dim background instead of full black
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
