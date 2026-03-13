import React from 'react';

const TransportControls = ({ isPlaying, onPlay, onPause, onStop, onSpeedChange }) => {
  return (
    <div className="transport-bar">
      <button className="btn" onClick={onStop} title="Stop">⏹</button>
      {isPlaying ? (
        <button className="btn" onClick={onPause} title="Pause">⏸</button>
      ) : (
        <button className="btn primary" onClick={onPlay} title="Play">▶</button>
      )}
      {[0.5, 1, 1.5, 2].map((s) => (
        <button key={s} className="btn" onClick={() => onSpeedChange?.(s)}>{s}x</button>
      ))}
    </div>
  );
};

export default TransportControls;
