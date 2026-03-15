import React, { useRef, useEffect } from 'react';

/** Map a 0-1 value to an inferno-like RGB color for a clear heatmap. */
function infernoColor(t) {
  // Simplified inferno: black → dark purple → red → orange → yellow → white
  const stops = [
    [0, 0, 4],
    [40, 11, 84],
    [120, 28, 109],
    [188, 55, 84],
    [237, 105, 37],
    [251, 180, 26],
    [252, 255, 164],
  ];
  const v = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const lo = Math.floor(v);
  const hi = Math.min(lo + 1, stops.length - 1);
  const frac = v - lo;
  return [
    Math.round(stops[lo][0] + frac * (stops[hi][0] - stops[lo][0])),
    Math.round(stops[lo][1] + frac * (stops[hi][1] - stops[lo][1])),
    Math.round(stops[lo][2] + frac * (stops[hi][2] - stops[lo][2])),
  ];
}

const SpectrogramViewer = ({ title, times, freqs, magnitudes }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = React.useState(800);

  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      if (width > 0) setCanvasWidth(width);
    }
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) setCanvasWidth(width);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!times || !freqs || !magnitudes || magnitudes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const numFreqs = magnitudes.length;
    const numTimes = magnitudes[0]?.length ?? 0;
    if (numFreqs === 0 || numTimes === 0) return;

    const imageData = ctx.createImageData(width, height);

    for (let x = 0; x < width; x++) {
      const tIdx = Math.floor((x / width) * numTimes);
      for (let y = 0; y < height; y++) {
        // Flip y so low freq is at bottom
        const fIdx = Math.floor(((height - 1 - y) / height) * numFreqs);
        const val = magnitudes[fIdx]?.[tIdx] ?? 0;
        const [r, g, b] = infernoColor(val);
        const idx = (y * width + x) * 4;
        imageData.data[idx]     = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw frequency labels on the left
    if (freqs.length > 0) {
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const labelCount = Math.min(5, numFreqs);
      for (let i = 0; i <= labelCount; i++) {
        const fIdx = Math.floor((i / labelCount) * (numFreqs - 1));
        const fVal = freqs[fIdx];
        const y = height - (fIdx / numFreqs) * height;
        ctx.fillText(fVal >= 1000 ? `${(fVal/1000).toFixed(1)}k` : `${Math.round(fVal)}`, 4, y);
      }
    }
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
