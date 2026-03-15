import React, { useRef, useEffect } from 'react';

const SpectrogramViewer = ({ title, times, freqs, magnitudes }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!times || !freqs || !magnitudes) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Normalize magnitudes to 0-255 for grayscale
    const maxVal = Math.max(...magnitudes.flat());
    const imageData = ctx.createImageData(width, height);
    // Resample magnitudes to canvas dimensions (simplified – just nearest neighbor)
    for (let x = 0; x < width; x++) {
      const tIdx = Math.floor((x / width) * times.length);
      for (let y = 0; y < height; y++) {
        const fIdx = Math.floor((y / height) * freqs.length);
        const val = magnitudes[fIdx]?.[tIdx] || 0;
        const gray = Math.floor(255 * (val / maxVal));
        const idx = (y * width + x) * 4;
        imageData.data[idx] = gray;
        imageData.data[idx+1] = gray;
        imageData.data[idx+2] = gray;
        imageData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [times, freqs, magnitudes]);

  return (
    <div>
      <h4>{title}</h4>
      <canvas ref={canvasRef} width={400} height={200} style={{ border: '1px solid #ccc' }} />
    </div>
  );
};

export default SpectrogramViewer;