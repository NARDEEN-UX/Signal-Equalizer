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

function viridisColor(t) {
  const x = clamp01(t);
  const r = Math.floor(255 * (0.267 + 0.45 * Math.pow(x, 1.35)));
  const g = Math.floor(255 * (0.004 + 0.93 * Math.pow(x, 0.9)));
  const b = Math.floor(255 * (0.329 + 0.58 * (1 - Math.pow(x, 0.75))));
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

function turboColor(t) {
  const x = clamp01(t);
  const r = Math.floor(255 * clamp01(1.5 * x));
  const g = Math.floor(255 * clamp01(1.8 * x * (1 - 0.45 * Math.abs(2 * x - 1))));
  const b = Math.floor(255 * clamp01(1.35 * (1 - x) * (1 - 0.2 * x)));
  return [r, g, b];
}

function grayscaleColor(t) {
  const x = clamp01(t);
  const gray = Math.floor(20 + 225 * x);
  return [gray, gray, gray];
}

function mapColor(scale, t) {
  if (scale === 'viridis') return viridisColor(t);
  if (scale === 'turbo') return turboColor(t);
  if (scale === 'grayscale') return grayscaleColor(t);
  return infernoColor(t);
}

const SpectrogramViewer = ({
  title,
  times,
  freqs,
  magnitudes,
  normalizationMax = null,
  colorScale = 'inferno',
  viewWindow: controlledViewWindow = null,
  onViewWindowChange = null
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = React.useState(800);
  const [viewWindow, setViewWindow] = React.useState({ t0: 0, t1: 1, f0: 0, f1: 1 });
  const [dragRect, setDragRect] = React.useState(null);
  const currentViewWindow = controlledViewWindow || viewWindow;

  const commitViewWindow = (nextWindow) => {
    if (typeof onViewWindowChange === 'function') {
      onViewWindowChange(nextWindow);
    }
    if (!controlledViewWindow) {
      setViewWindow(nextWindow);
    }
  };

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

  // Only reset zoom when times/freqs change (new signal), not when magnitudes change (processing update)
  useEffect(() => {
    commitViewWindow({ t0: 0, t1: 1, f0: 0, f1: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, freqs]);

  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setDragRect({ x0: x, y0: y, x1: x, y1: y, active: true });
  };

  const handleMouseMove = (e) => {
    if (!dragRect?.active || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setDragRect((d) => (d ? { ...d, x1: x, y1: y } : d));
  };

  const finishSelectionZoom = () => {
    if (!dragRect?.active || !containerRef.current) {
      setDragRect(null);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x0 = Math.min(dragRect.x0, dragRect.x1);
    const x1 = Math.max(dragRect.x0, dragRect.x1);
    const y0 = Math.min(dragRect.y0, dragRect.y1);
    const y1 = Math.max(dragRect.y0, dragRect.y1);
    setDragRect(null);

    if (x1 - x0 < 6 || y1 - y0 < 6) return;

    if (!freqs || freqs.length === 0) return;

    const xr0 = x0 / Math.max(1, rect.width);
    const xr1 = x1 / Math.max(1, rect.width);
    const yr0 = y0 / Math.max(1, rect.height);
    const yr1 = y1 / Math.max(1, rect.height);

    const w = currentViewWindow;
    const tSpan = w.t1 - w.t0;
    
    const t0n = w.t0 + xr0 * tSpan;
    const t1n = w.t0 + xr1 * tSpan;

    // Translate the current state bounds into true frequencies
    const fStartIdx = Math.floor(w.f0 * Math.max(0, freqs.length - 1));
    const fEndIdx = Math.floor(w.f1 * Math.max(0, freqs.length - 1));
    const lowSel = Number(freqs[Math.max(0, Math.min(freqs.length - 1, fStartIdx))]) || 0;
    const highSel = Number(freqs[Math.max(0, Math.min(freqs.length - 1, fEndIdx))]) || 1;
    const minFreqSel = Math.max(1, Math.min(lowSel, highSel));
    const maxFreqSel = Math.max(minFreqSel + 1, Math.max(lowSel, highSel));
    const useLogFreq = maxFreqSel > 1000;

    // Identify the frequency boundary that the user's cursor physically selected
    const getFreqStrata = (yNorm) => {
      if (useLogFreq) {
        const minF = Math.max(1, minFreqSel);
        const maxF = Math.max(maxFreqSel, minF + 1);
        const logMin = Math.log10(minF);
        const logMax = Math.log10(maxF);
        return Math.pow(10, logMin + (1 - yNorm) * (logMax - logMin));
      }
      return minFreqSel + (1 - yNorm) * (maxFreqSel - minFreqSel);
    };

    const fTop = getFreqStrata(yr0);
    const fBottom = getFreqStrata(yr1);

    // Now map those true frequencies back down onto a strict 0.0 - 1.0 array fraction
    const maxAvailableFreq = Number(freqs[freqs.length - 1]) || 1;
    let nf0 = Math.min(fTop, fBottom) / maxAvailableFreq;
    let nf1 = Math.max(fTop, fBottom) / maxAvailableFreq;

    let nt0 = Math.max(0, Math.min(1, t0n));
    let nt1 = Math.max(0, Math.min(1, t1n));
    if (nt1 - nt0 < 0.02) {
      const c = (nt0 + nt1) / 2;
      nt0 = Math.max(0, c - 0.01);
      nt1 = Math.min(1, c + 0.01);
    }

    nf0 = Math.max(0, Math.min(1, nf0));
    nf1 = Math.max(0, Math.min(1, nf1));
    if (nf1 - nf0 < 0.01) {
      const c = (nf0 + nf1) / 2;
      nf0 = Math.max(0, c - 0.005);
      nf1 = Math.min(1, c + 0.005);
    }

    commitViewWindow({ t0: nt0, t1: nt1, f0: nf0, f1: nf1 });
  };

  const handleResetZoom = () => {
    commitViewWindow({ t0: 0, t1: 1, f0: 0, f1: 1 });
  };

  useEffect(() => {
    if (!times || !freqs || !magnitudes) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const rows = Array.isArray(magnitudes) ? magnitudes.length : 0;
    const cols = rows > 0 && Array.isArray(magnitudes[0]) ? magnitudes[0].length : 0;
    if (!rows || !cols) {
      // Clear canvas and draw "No data" message
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#737373";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No spectrogram data", width / 2, height / 2);
      return;
    }

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

    const fStartIdx = Math.floor(currentViewWindow.f0 * Math.max(0, freqs.length - 1));
    const fEndIdx = Math.floor(currentViewWindow.f1 * Math.max(0, freqs.length - 1));
    const lowSel = Number(freqs[Math.max(0, Math.min(freqs.length - 1, fStartIdx))]) || 0;
    const highSel = Number(freqs[Math.max(0, Math.min(freqs.length - 1, fEndIdx))]) || 1;
    const minFreqSel = Math.max(1, Math.min(lowSel, highSel));
    const maxFreqSel = Math.max(minFreqSel + 1, Math.max(lowSel, highSel));
    const useLogFreq = maxFreqSel > 1000;

    const yToFIdx = new Array(height);
    for (let y = 0; y < height; y += 1) {
      const yNorm = y / Math.max(1, height - 1);
      let targetFreq;

      if (useLogFreq) {
        const minFreq = Math.max(1, minFreqSel);
        const maxF = Math.max(maxFreqSel, minFreq + 1);
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxF);
        targetFreq = Math.pow(10, logMin + (1 - yNorm) * (logMax - logMin));
      } else {
        targetFreq = minFreqSel + (1 - yNorm) * (maxFreqSel - minFreqSel);
      }

      let idx = 0;
      while (idx + 1 < freqs.length && Number(freqs[idx + 1]) <= targetFreq) {
        idx += 1;
      }
      yToFIdx[y] = idx;
    }

    const imageData = ctx.createImageData(width, height);

    for (let x = 0; x < width; x += 1) {
      const tNorm = currentViewWindow.t0 + (x / Math.max(1, width - 1)) * (currentViewWindow.t1 - currentViewWindow.t0);
      const tIdx = Math.min(times.length - 1, Math.floor(tNorm * (times.length - 1)));
      for (let y = 0; y < height; y += 1) {
        const fIdx = yToFIdx[y];
        const raw = getMag(fIdx, tIdx);
        const db = isDbInput
          ? (Number.isFinite(raw) ? raw : minDb)
          : 20 * Math.log10(Math.max(raw, 1e-12) / linearRef);
        const norm = Math.min(1, Math.max(0, (db - minDb) / dbSpan));

        const [r, g, b] = mapColor(colorScale, Math.pow(norm, 0.9));
        const idx = (y * width + x) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [times, freqs, magnitudes, normalizationMax, colorScale, canvasWidth, currentViewWindow]);

  return (
    <div>
      {title && <h4>{title}</h4>}
      <div
        ref={containerRef}
        style={{ width: '100%', position: 'relative' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishSelectionZoom}
        onMouseLeave={finishSelectionZoom}
        onDoubleClick={handleResetZoom}
        title="Drag to select spectrogram zoom region. Double-click: reset."
      >
        <canvas 
          ref={canvasRef} 
          width={canvasWidth} 
          height={280}
          style={{ width: '100%', height: '280px', display: 'block' }}
        />
        {dragRect?.active && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(dragRect.x0, dragRect.x1)}px`,
              top: `${Math.min(dragRect.y0, dragRect.y1)}px`,
              width: `${Math.max(1, Math.abs(dragRect.x1 - dragRect.x0))}px`,
              height: `${Math.max(1, Math.abs(dragRect.y1 - dragRect.y0))}px`,
              border: '1px solid rgba(255,255,255,0.75)',
              background: 'rgba(255,255,255,0.15)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SpectrogramViewer;
