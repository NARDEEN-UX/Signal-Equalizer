import React from 'react';

const SliderGroup = ({ count, labels, values, onChange }) => {
  const handleChange = (index, newVal) => {
    const updated = [...values];
    updated[index] = parseFloat(newVal);
    onChange(updated);
  };

  return (
    <div className="slider-group">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="slider-item">
          <label>{labels[i]}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={values[i]}
            onChange={(e) => handleChange(i, e.target.value)}
          />
          <span>{values[i].toFixed(2)}x</span>
        </div>
      ))}
    </div>
  );
};

export default SliderGroup;