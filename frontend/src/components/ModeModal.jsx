import React, { useEffect } from 'react';

const ModeModal = ({ open, modes, activeModeId, onClose, onSelect }) => {
  const visibleModes = Array.isArray(modes)
    ? modes.filter((m) => m?.id !== 'ai-music')
    : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Change Equalizer Mode" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 className="modal-title">Change Equalizer Mode</h3>
            <p className="modal-subtitle">Select the mode that best fits your processing needs</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-list">
          {visibleModes.map((m) => {
            const active = m.id === activeModeId;
            return (
              <button
                key={m.id}
                type="button"
                className={`modal-item ${active ? 'active' : ''} ${m.disabled ? 'disabled' : ''}`}
                disabled={m.disabled}
                onClick={() => !m.disabled && onSelect?.(m.id)}
              >
                <div className={`modal-icon ${m.accentClass}`} aria-hidden>
                  {m.icon || '◈'}
                </div>
                <div className="modal-item-body">
                  <div className="modal-item-top">
                    <div className="modal-item-title">{m.name}</div>
                    {active && <span className="pill pill-active">Active</span>}
                    {m.disabled && <span className="pill pill-soon">Soon</span>}
                  </div>
                  <div className="modal-item-desc">{m.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ModeModal;

