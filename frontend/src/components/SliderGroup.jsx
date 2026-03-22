import React, { useEffect, useRef, useState } from 'react';

const SliderGroup = ({ count, labels, values, onChange }) => {
  const [localValues, setLocalValues] = useState(() => {
    const base = Array.from({ length: count }, (_, i) => {
      const n = Number(values?.[i]);
      return Number.isFinite(n) ? n : 1;
    });
    return base;
  });
  const commitRafRef = useRef(null);
  const pendingCommitRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const base = Array.from({ length: count }, (_, i) => {
      const n = Number(values?.[i]);
      return Number.isFinite(n) ? n : 1;
    });
    setLocalValues(base);
  }, [count, values]);

  useEffect(() => () => {
    if (commitRafRef.current) {
      cancelAnimationFrame(commitRafRef.current);
      commitRafRef.current = null;
    }
    pendingCommitRef.current = null;
  }, []);

  const commit = (updated) => {
    onChange(updated);
  };

  const scheduleCommit = (updated) => {
    pendingCommitRef.current = updated;
    if (commitRafRef.current) {
      return;
    }
    commitRafRef.current = requestAnimationFrame(() => {
      const latest = pendingCommitRef.current;
      if (latest) {
        commit(latest);
      }
      pendingCommitRef.current = null;
      commitRafRef.current = null;
    });
  };

  const handleChange = (index, newVal) => {
    const updated = [...localValues];
    updated[index] = parseFloat(newVal);
    setLocalValues(updated);
    scheduleCommit(updated);
  };

  const flushCommit = () => {
    if (commitRafRef.current) {
      cancelAnimationFrame(commitRafRef.current);
      commitRafRef.current = null;
    }
    const latest = pendingCommitRef.current || localValues;
    pendingCommitRef.current = null;
    commit(latest);
  };

  return (
    <div className="slider-group">
      {Array.from({ length: count }).map((_, i) => {
        const n = Number(localValues?.[i]);
        const val = Number.isFinite(n) ? n : 1;
        const pct = ((val - 0) / 2) * 100;
        const label = labels?.[i] || `Band ${i + 1}`;
        return (
          <div key={i} className="slider-item">
            <div className="slider-row">
              <label>{label}</label>
              <span className="slider-value">{val.toFixed(2)}×</span>
            </div>
            <div className="slider-track-wrap" style={{ '--val': val }}>
              <div className="slider-track-fill" />
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={val}
                onPointerDown={() => {
                  isDraggingRef.current = true;
                }}
                onPointerUp={() => {
                  isDraggingRef.current = false;
                  flushCommit();
                }}
                onMouseUp={flushCommit}
                onTouchEnd={flushCommit}
                onChange={(e) => handleChange(i, e.target.value)}
                aria-label={label}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SliderGroup;
