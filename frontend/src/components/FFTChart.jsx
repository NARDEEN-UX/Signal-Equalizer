import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Title, Tooltip, Legend);

/** One FFT plot: freq vs magnitude; variant "input"|"output" for single-panel cards, or both. */
const FFTChart = ({ data, audiogram, variant, zoomWindow = null, onZoomWindowChange = null }) => {
  if (!data || !Array.isArray(data.freq) || !Array.isArray(data.in) || !Array.isArray(data.out)) {
    return <div className="chart-wrap">No FFT data</div>;
  }

  const freq = data.freq.map((v) => Number(v) || 0);
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const [xWindow, setXWindow] = useState(null);
  const [yWindow, setYWindow] = useState(null);
  const [drag, setDrag] = useState(null);
  const controlled = Boolean(onZoomWindowChange);
  const effectiveXWindow = controlled ? (zoomWindow?.x || null) : xWindow;
  const effectiveYWindow = controlled ? (zoomWindow?.y || null) : yWindow;

  const yDomain = useMemo(() => {
    // Use the true max of both input and output so boosted signals are never clipped.
    const inputData = Array.isArray(data?.in) ? data.in : [];
    const outputData = Array.isArray(data?.out) ? data.out : [];

    let maxVal = 0;
    for (let i = 0; i < inputData.length; i++) {
      const v = Number(inputData[i]);
      if (v > maxVal) maxVal = v;
    }
    for (let i = 0; i < outputData.length; i++) {
      const v = Number(outputData[i]);
      if (v > maxVal) maxVal = v;
    }

    const paddedMax = maxVal > 0 ? maxVal * 1.15 : 2;
    return { min: 0, max: Math.max(0.1, paddedMax) };
  }, [data]);

  const domain = useMemo(() => {
    const positive = freq.filter((f) => f > 0);
    const minFreq = positive.length ? Math.min(...positive) : 1;
    const maxFreq = freq.length ? Math.max(...freq) : minFreq;
    return {
      min: Math.max(1e-6, minFreq),
      max: Math.max(minFreq + 1, maxFreq)
    };
  }, [freq]);

  const inputSeries = useMemo(() => {
    const values = Array.isArray(data?.in) ? data.in : [];
    return freq
      .map((x, idx) => ({ x, y: Number(values[idx]) || 0 }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (audiogram ? p.x > 0 : true));
  }, [freq, data, audiogram]);

  const outputSeries = useMemo(() => {
    const values = Array.isArray(data?.out) ? data.out : [];
    return freq
      .map((x, idx) => ({ x, y: Number(values[idx]) || 0 }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (audiogram ? p.x > 0 : true));
  }, [freq, data, audiogram]);

  useEffect(() => {
    if (controlled) return;
    setXWindow(null);
    setYWindow(null);
  }, [data, audiogram, controlled]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const clampWindow = (min, max) => {
    const fullMin = domain.min;
    const fullMax = domain.max;
    const fullSpan = fullMax - fullMin;
    const minSpan = Math.max(fullSpan * 0.002, audiogram ? 10 : 1);
    const span = Math.min(fullSpan, Math.max(minSpan, max - min));

    // Keep the selected midpoint as the center of the new zoom view.
    const center = (min + max) / 2;
    let nextMin = center - span / 2;
    let nextMax = center + span / 2;

    if (nextMin < fullMin) {
      nextMin = fullMin;
      nextMax = fullMin + span;
    }
    if (nextMax > fullMax) {
      nextMax = fullMax;
      nextMin = fullMax - span;
    }

    return { min: nextMin, max: nextMax };
  };

  const clampYWindow = (min, max) => {
    const fullMin = yDomain.min;
    const fullMax = yDomain.max;
    const fullSpan = fullMax - fullMin;
    const minSpan = Math.max(0.02, fullSpan * 0.02);
    const span = Math.min(fullSpan, Math.max(minSpan, max - min));

    // Keep the selected midpoint as the center of the new zoom view.
    const center = (min + max) / 2;
    let nextMin = center - span / 2;
    let nextMax = center + span / 2;

    if (nextMin < fullMin) {
      nextMin = fullMin;
      nextMax = fullMin + span;
    }
    if (nextMax > fullMax) {
      nextMax = fullMax;
      nextMin = fullMax - span;
    }

    return { min: nextMin, max: nextMax };
  };

  const getDragPoint = (e) => {
    const chart = chartRef.current;
    const wrap = wrapRef.current;
    if (!chart?.canvas || !chart?.chartArea || !wrap) return null;

    const canvasRect = chart.canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    const rawCssX = e.clientX - canvasRect.left;
    const rawCssY = e.clientY - canvasRect.top;
    const rawWrapX = e.clientX - wrapRect.left;
    const rawWrapY = e.clientY - wrapRect.top;

    const area = chart.chartArea;
    // Keep zoom mapping bounded to plot area, but allow free drag rectangle movement in the wrapper.
    const canvasX = clamp(rawCssX, area.left, area.right);
    const canvasY = clamp(rawCssY, area.top, area.bottom);
    const drawX = clamp(rawWrapX, 0, wrapRect.width);
    const drawY = clamp(rawWrapY, 0, wrapRect.height);

    return { canvasX, canvasY, drawX, drawY };
  };

  const handleMouseDown = (e) => {
    const p = getDragPoint(e);
    if (!p) return;
    setDrag({
      startCanvasX: p.canvasX,
      startCanvasY: p.canvasY,
      currentCanvasX: p.canvasX,
      currentCanvasY: p.canvasY,
      startX: p.drawX,
      startY: p.drawY,
      currentX: p.drawX,
      currentY: p.drawY,
      active: true
    });
  };

  const handleMouseMove = (e) => {
    if (!drag?.active) return;
    const p = getDragPoint(e);
    if (!p) return;
    setDrag((d) =>
      d
        ? {
          ...d,
          currentCanvasX: p.canvasX,
          currentCanvasY: p.canvasY,
          currentX: p.drawX,
          currentY: p.drawY
        }
        : d
    );
  };

  useEffect(() => {
    if (!drag?.active) return undefined;

    const onMove = (evt) => handleMouseMove(evt);
    const onUp = () => finishDragZoom();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  const finishDragZoom = () => {
    const chart = chartRef.current;
    if (!drag?.active || !chart?.scales?.x || !chart?.scales?.y) {
      setDrag(null);
      return;
    }

    const x0 = Math.min(drag.startX, drag.currentX);
    const x1 = Math.max(drag.startX, drag.currentX);
    const y0 = Math.min(drag.startY, drag.currentY);
    const y1 = Math.max(drag.startY, drag.currentY);

    const cx0 = Math.min(drag.startCanvasX, drag.currentCanvasX);
    const cx1 = Math.max(drag.startCanvasX, drag.currentCanvasX);
    const cy0 = Math.min(drag.startCanvasY, drag.currentCanvasY);
    const cy1 = Math.max(drag.startCanvasY, drag.currentCanvasY);
    setDrag(null);

    if (x1 - x0 < 6 || y1 - y0 < 6) return;

    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const f0 = Number(xScale.getValueForPixel(cx0));
    const f1 = Number(xScale.getValueForPixel(cx1));
    const mTop = Number(yScale.getValueForPixel(cy0));
    const mBottom = Number(yScale.getValueForPixel(cy1));

    if (!Number.isFinite(f0) || !Number.isFinite(f1) || !Number.isFinite(mTop) || !Number.isFinite(mBottom)) {
      return;
    }

    const nextX = clampWindow(Math.min(f0, f1), Math.max(f0, f1));
    const nextY = clampYWindow(Math.min(mTop, mBottom), Math.max(mTop, mBottom));
    if (controlled) {
      onZoomWindowChange?.({ x: nextX, y: nextY });
    } else {
      setXWindow(nextX);
      setYWindow(nextY);
    }
  };

  const handleResetZoom = () => {
    if (controlled) {
      onZoomWindowChange?.({ x: null, y: null });
    } else {
      setXWindow(null);
      setYWindow(null);
    }
  };

  const datasets = [];
  if (!variant || variant === 'input') {
    datasets.push({ label: 'Input', data: inputSeries, borderColor: '#ef4444', borderWidth: 2, pointRadius: 0, tension: 0.2 });
  }
  if (!variant || variant === 'output') {
    datasets.push({ label: 'Output', data: outputSeries, borderColor: '#22d3ee', borderWidth: 2, pointRadius: 0, tension: 0.2 });
  }

  const chartData = {
    datasets
  };

  const fontFamily = "'Plus Jakarta Sans', -apple-system, sans-serif";
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    scales: {
      x: {
        type: audiogram ? 'logarithmic' : 'linear',
        min: effectiveXWindow?.min,
        max: effectiveXWindow?.max,
        title: { display: true, text: 'Frequency (Hz)', color: '#737373', font: { family: fontFamily, size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#737373', font: { family: fontFamily, size: 10 } }
      },
      y: {
        min: effectiveYWindow?.min ?? yDomain.min,
        max: effectiveYWindow?.max ?? yDomain.max,
        title: { display: true, text: 'Magnitude', color: '#737373', font: { family: fontFamily, size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#737373', font: { family: fontFamily, size: 10 } }
      }
    },
    plugins: {
      legend: { labels: { color: '#f2f2f2', font: { family: fontFamily, size: 11 } } }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {(effectiveXWindow || effectiveYWindow) && (
        <button
          type="button"
          onClick={handleResetZoom}
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            zIndex: 10,
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.5)',
            color: '#f2f2f2',
            cursor: 'pointer'
          }}
        >
          Reset Zoom
        </button>
      )}
      <div
        className="chart-wrap"
        style={{ height: 300, position: 'relative' }}
        ref={wrapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishDragZoom}
        onDoubleClick={handleResetZoom}
        title="Drag to select FFT zoom region. Double-click: reset."
      >
        <Line ref={chartRef} data={chartData} options={options} />
        {drag?.active && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(drag.startX, drag.currentX)}px`,
              top: `${Math.min(drag.startY, drag.currentY)}px`,
              width: `${Math.max(1, Math.abs(drag.currentX - drag.startX))}px`,
              height: `${Math.max(1, Math.abs(drag.currentY - drag.startY))}px`,
              border: '1px solid rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.15)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    </div>
  );
};

export default FFTChart;
