import React from 'react';

const AudiogramToggle = ({ checked, onChange }) => {
  return (
    <div className="audiogram-toggle">
      <div className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked} />
      <label onClick={() => onChange(!checked)}>Audiogram scale</label>
    </div>
  );
};

export default AudiogramToggle;
