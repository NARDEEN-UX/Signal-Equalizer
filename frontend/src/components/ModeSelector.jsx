import React from 'react';

const ModeSelector = ({ mode, setMode, compact, inHeader }) => {
  const options = [
    { id: 'human', label: 'Human mode' },
    { id: 'ai', label: 'AI Separation', disabled: true },
  ];

  if (inHeader) {
    return (
      <button
        type="button"
        className="btn btn-header"
        onClick={() => {}}
        title="Change mode"
      >
        <span className="btn-icon">{'◐'}</span>
        Change Mode
      </button>
    );
  }

  return (
    <div className={`segmented-control ${compact ? 'compact' : ''}`} role="group" aria-label="Mode">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`segmented-option ${mode === opt.id ? 'active' : ''} ${opt.disabled ? 'disabled' : ''}`}
          onClick={() => !opt.disabled && setMode(opt.id)}
          disabled={opt.disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;
