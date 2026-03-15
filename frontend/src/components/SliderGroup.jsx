import React from 'react';

const SliderGroup = ({ count, labels, values, onChange }) => {
  const handleChange = (index, newVal) => {
    const updated = [...values];
    updated[index] = parseFloat(newVal);
    onChange(updated);
  };

  return (
    <div className="slider-group">
      {Array.from({ length: count }).map((_, i) => {
        const val = values[i];
        const pct = ((val - 0) / 2) * 100;
        return (
          <div key={i} className="slider-item">
            <div className="slider-row">
              <label>{labels[i]}</label>
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
                onChange={(e) => handleChange(i, e.target.value)}
                aria-label={labels[i]}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SliderGroup;
