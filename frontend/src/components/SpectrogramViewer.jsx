import React, { useRef, useEffect } from 'react';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function infernoColor(t) {
  const x = clamp01(t);
  // Keep highlights bright but avoid full white washout at high energy.
  const r = Math.floor(245 * Math.pow(x, 0.55));
  const g = Math.floor(210 * Math.pow(x, 1.2));
  const b = Math.floor(120 * Math.pow(x, 2.2));
  return [r, g, b];
}

const SpectrogramViewer = ({ title, times, freqs, magnitudes, normalizationMax = null }) => {
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

    const rows = Array.isArray(magnitudes) ? magnitudes.length : 0;
    const cols = rows > 0 && Array.isArray(magnitudes[0]) ? magnitudes[0].length : 0;
    if (!rows || !cols) return;

    // Support both [freq][time] and [time][freq] layouts from different backends.
    const isFreqByTime = rows === freqs.length && cols === times.length;
    const isTimeByFreq = rows === times.length && cols === freqs.length;

    const getMag = (fIdx, tIdx) => {
      if (isFreqByTime) {
        const row = magnitudes[fIdx];
        return Number(Array.isArray(row) ? row[tIdx] : 0) || 0;
      }
      if (isTimeByFreq) {
        const row = magnitudes[tIdx];
        return Number(Array.isArray(row) ? row[fIdx] : 0) || 0;
      }

      // Fallback for imperfect shapes: assume freq-major and clamp indices.
      const rf = Math.min(rows - 1, fIdx);
      const row = magnitudes[rf];
      if (!Array.isArray(row)) return 0;
      const ct = Math.min(row.length - 1, tIdx);
      return Number(row[ct]) || 0;
    };

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let r = 0; r < rows; r += 1) {
      const row = magnitudes[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c += 1) {
        const v = Number(row[c]);
        if (!Number.isFinite(v)) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    // Support both:
    // - dB matrices from backend (typically <= 0, often negative)
    // - linear magnitude matrices from mock/fallback paths (>= 0)
    const isDbInput = minVal < -1 || maxVal > 10;

    const minDb = -80;
    const maxDb = 0;
    const dbSpan = maxDb - minDb;
    const linearRef = Number(normalizationMax) > 0 ? Number(normalizationMax) : Math.max(maxVal, 1e-8);

    const maxFreq = Math.max(Number(freqs[freqs.length - 1]) || 0, 1);
    const useLogFreq = maxFreq > 1000;

    const yToFIdx = new Array(height);
    for (let y = 0; y < height; y += 1) {
      const yNorm = y / Math.max(1, height - 1);
      let targetFreq;

      if (useLogFreq) {
        const minFreq = 20;
        const maxF = Math.max(maxFreq, minFreq + 1);
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxF);
        targetFreq = Math.pow(10, logMin + (1 - yNorm) * (logMax - logMin));
      } else {
        targetFreq = (1 - yNorm) * maxFreq;
      }

      let idx = 0;
      while (idx + 1 < freqs.length && Number(freqs[idx + 1]) <= targetFreq) {
        idx += 1;
      }
      yToFIdx[y] = idx;
    }

    const imageData = ctx.createImageData(width, height);

    for (let x = 0; x < width; x += 1) {
      const tIdx = Math.min(times.length - 1, Math.floor((x / Math.max(1, width - 1)) * (times.length - 1)));
      for (let y = 0; y < height; y += 1) {
        const fIdx = yToFIdx[y];
        const raw = getMag(fIdx, tIdx);
        const db = isDbInput
          ? (Number.isFinite(raw) ? raw : minDb)
          : 20 * Math.log10(Math.max(raw, 1e-12) / linearRef);
        const norm = Math.min(1, Math.max(0, (db - minDb) / dbSpan));

        const [r, g, b] = infernoColor(Math.pow(norm, 0.9));
        const idx = (y * width + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [times, freqs, magnitudes, normalizationMax, canvasWidth]);

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
