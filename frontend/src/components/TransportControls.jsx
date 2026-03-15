import React from 'react';

const TransportControls = ({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  volume = 1,
  zoom = 1,
  onVolumeChange
}) => {
  return (
    <div className="transport-bar">
      <button type="button" className="btn btn-transport" onClick={onStop} title="Stop">⏹</button>
      {isPlaying ? (
        <button type="button" className="btn btn-transport" onClick={onPause} title="Pause">⏸</button>
      ) : (
        <button type="button" className="btn btn-transport primary" onClick={onPlay} title="Play">▶</button>
      )}
      <span className="transport-volume" title="Volume">{volume.toFixed(1)}</span>
      <input
        type="range"
        className="transport-volume-slider"
        min="0"
        max="2"
        step="0.1"
        value={volume}
        onChange={(e) => onVolumeChange?.(e.target.value)}
        title="Volume"
      />
      <span className="transport-zoom" title="Zoom">{zoom.toFixed(1)}×</span>
      <button type="button" className="btn btn-transport" title="Zoom in">+</button>
      <button type="button" className="btn btn-transport" title="Zoom out">−</button>
      {[0.5, 1, 1.5, 2].map((s) => (
        <button key={s} type="button" className="btn btn-transport" onClick={() => onSpeedChange?.(s)}>{s}×</button>
      ))}
    </div>
  );
};

export default TransportControls;
