import React, { useRef, useCallback, useState } from 'react';

const PAD = { left: 36, right: 24, top: 28, bottom: 48 };
const MIN = 0;
const MAX = 2;

function valueToY(value, chartHeight) {
  const t = (value - MIN) / (MAX - MIN);
  return PAD.top + (1 - t) * chartHeight;
}

function yToValue(y, chartHeight) {
  const t = 1 - (y - PAD.top) / chartHeight;
  return Math.max(MIN, Math.min(MAX, MIN + t * (MAX - MIN)));
}

// Line path through points (smooth appearance via strokeLinecap/round)
function linePathThrough(xs, ys) {
  if (xs.length < 2) return `M ${xs[0]} ${ys[0]} L ${xs[1]} ${ys[1]}`;
  return `M ${xs[0]} ${ys[0]}` + xs.slice(1).map((x, i) => ` L ${x} ${ys[i + 1]}`).join('');
}

function areaPathUnder(xs, ys, baseY) {
  return linePathThrough(xs, ys) + ` L ${xs[xs.length - 1]} ${baseY} L ${xs[0]} ${baseY} Z`;
}

const EqualizerCurve = ({ labels, values, onChange }) => {
  const svgRef = useRef(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const [dragging, setDragging] = useState(null);

  const chartWidth = 240;
  const chartHeight = 120;
  const width = chartWidth + PAD.left + PAD.right;
  const height = chartHeight + PAD.top + PAD.bottom;
  const baseY = PAD.top + chartHeight;

  const n = values.length;
  const xs = Array.from({ length: n }, (_, i) =>
    PAD.left + (chartWidth / Math.max(1, n - 1)) * i
  );
  const ys = values.map((v) => valueToY(v, chartHeight));

  const areaPath = areaPathUnder(xs, ys, baseY);
  const linePath = linePathThrough(xs, ys);

  const handlePointerDown = useCallback(
    (e, index) => {
      e.preventDefault();
      setDragging(index);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (dragging === null) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const yViewBox = ((e.clientY - rect.top) / rect.height) * height;
      const chartH = height - PAD.top - PAD.bottom;
      const value = yToValue(yViewBox, chartH);
      const current = valuesRef.current;
      const updated = [...current];
      updated[dragging] = Math.round(value * 100) / 100;
      onChange(updated);
    },
    [dragging, onChange, height]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  React.useEffect(() => {
    if (dragging === null) return;
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => {
      handlePointerUp();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const yTicks = [0, 0.5, 1, 1.5, 2];

  return (
    <div className="equalizer-curve-wrap">
      <svg
        ref={svgRef}
        className="equalizer-curve"
        viewBox={`0 0 ${width} ${height}`}
        onPointerLeave={dragging !== null ? handlePointerUp : undefined}
      >
        <defs>
          <linearGradient id="eq-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent-mid)" stopOpacity="0.4" />
            <stop offset="60%" stopColor="var(--accent-in)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--accent-in)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Y-axis labels 0.0, 0.5, 1.0, 1.5, 2.0 */}
        {yTicks.map((t) => {
          const y = valueToY(t, chartHeight);
          return (
            <text key={t} x={PAD.left - 6} y={y + 4} textAnchor="end" className="equalizer-y-label" fill="var(--text-muted)">{t}</text>
          );
        })}
        <path d={areaPath} fill="url(#eq-fill)" />
        <path d={linePath} fill="none" stroke="var(--accent-in)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={ys[i]}
              r="9"
              fill="var(--bg-card)"
              stroke="var(--accent-in)"
              strokeWidth="2"
              className="equalizer-point"
              onPointerDown={(e) => handlePointerDown(e, i)}
              style={{ cursor: 'grab' }}
            />
            <text
              x={x}
              y={height - 14}
              textAnchor="middle"
              className="equalizer-label"
              fill="var(--text-secondary)"
            >
              {labels[i]} {values[i].toFixed(2)}×
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default EqualizerCurve;
