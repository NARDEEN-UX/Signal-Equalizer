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
const FFTChart = ({ data, audiogram, variant }) => {
  if (!data || !Array.isArray(data.freq) || !Array.isArray(data.in) || !Array.isArray(data.out)) {
    return <div className="chart-wrap">No FFT data</div>;
  }

  const freq = data.freq.map((v) => Number(v) || 0);
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const [xWindow, setXWindow] = useState(null);
  const [yWindow, setYWindow] = useState(null);
  const [drag, setDrag] = useState(null);

  const yDomain = useMemo(() => {
    const combined = [
      ...(Array.isArray(data?.in) ? data.in : []),
      ...(Array.isArray(data?.out) ? data.out : [])
    ];

    let maxVal = 0;
    for (let i = 0; i < combined.length; i += 1) {
      const v = Number(combined[i]);
      if (Number.isFinite(v) && v > maxVal) maxVal = v;
    }

    const paddedMax = maxVal > 0 ? maxVal * 1.05 : 2;
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

  useEffect(() => {
    setXWindow(null);
    setYWindow(null);
  }, [data, audiogram]);

  const clampWindow = (min, max) => {
    const fullMin = domain.min;
    const fullMax = domain.max;
    const fullSpan = fullMax - fullMin;
    const minSpan = Math.max(fullSpan * 0.002, audiogram ? 10 : 1);
    const span = Math.min(fullSpan, Math.max(minSpan, max - min));

    let nextMin = min;
    let nextMax = min + span;

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

    let nextMin = min;
    let nextMax = min + span;

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
    const ratioX = chart.canvas.width / Math.max(1, canvasRect.width);
    const ratioY = chart.canvas.height / Math.max(1, canvasRect.height);

    const rawCssX = e.clientX - canvasRect.left;
    const rawCssY = e.clientY - canvasRect.top;
    const rawCanvasX = rawCssX * ratioX;
    const rawCanvasY = rawCssY * ratioY;

    const area = chart.chartArea;
    const canvasX = Math.max(area.left, Math.min(area.right, rawCanvasX));
    const canvasY = Math.max(area.top, Math.min(area.bottom, rawCanvasY));

    const cssX = canvasX / Math.max(ratioX, 1e-6);
    const cssY = canvasY / Math.max(ratioY, 1e-6);
    const drawX = canvasRect.left - wrapRect.left + cssX;
    const drawY = canvasRect.top - wrapRect.top + cssY;

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

    setXWindow(clampWindow(Math.min(f0, f1), Math.max(f0, f1)));
    setYWindow(clampYWindow(Math.min(mTop, mBottom), Math.max(mTop, mBottom)));
  };

  const handleResetZoom = () => {
    setXWindow(null);
    setYWindow(null);
  };

  const datasets = [];
  if (!variant || variant === 'input') {
    datasets.push({ label: 'Input', data: data.in, borderColor: '#531009', borderWidth: 2, pointRadius: 0, tension: 0.2 });
  }
  if (!variant || variant === 'output') {
    datasets.push({ label: 'Output', data: data.out, borderColor: '#3e0c07', borderWidth: 2, pointRadius: 0, tension: 0.2 });
  }

  const chartData = {
    labels: freq,
    datasets
  };

  const fontFamily = "'Plus Jakarta Sans', -apple-system, sans-serif";
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: audiogram ? 'logarithmic' : 'linear',
        min: xWindow?.min,
        max: xWindow?.max,
        title: { display: true, text: 'Frequency (Hz)', color: '#737373', font: { family: fontFamily, size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#737373', font: { family: fontFamily, size: 10 } }
      },
      y: {
        min: yWindow?.min ?? yDomain.min,
        max: yWindow?.max ?? yDomain.max,
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
    <div
      className="chart-wrap"
      style={{ height: 300 }}
      ref={wrapRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishDragZoom}
      onMouseLeave={finishDragZoom}
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
  );
};

export default FFTChart;
