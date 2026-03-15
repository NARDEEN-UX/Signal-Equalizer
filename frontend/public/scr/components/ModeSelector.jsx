import React from 'react';

const ModeSelector = ({ mode, setMode }) => {
  return (
    <div className="controls-row">
      <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Mode:</span>
      <button
        className={`btn ${mode === 'human' ? 'primary' : ''}`}
        onClick={() => setMode('human')}
      >
        Human Voices
      </button>
    </div>
  );
};

export default ModeSelector;
