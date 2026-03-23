import React from 'react';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const MIN_BAND_WIDTH_HZ = 1;

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBandRange(low, high, maxHz) {
  const maxLimit = Math.max(MIN_BAND_WIDTH_HZ, toFiniteNumber(maxHz, 20000));
  let safeLow = toFiniteNumber(low, 0);
  let safeHigh = toFiniteNumber(high, safeLow + 500);

  safeLow = clamp(safeLow, 0, Math.max(0, maxLimit - MIN_BAND_WIDTH_HZ));
  safeHigh = clamp(safeHigh, safeLow + MIN_BAND_WIDTH_HZ, maxLimit);

  if (safeHigh <= safeLow) {
    safeLow = Math.max(0, maxLimit - MIN_BAND_WIDTH_HZ);
    safeHigh = maxLimit;
  }

  return { low: safeLow, high: safeHigh };
}

function nextBandOrdinal(bands) {
  let maxNum = 0;
  (Array.isArray(bands) ? bands : []).forEach((b) => {
    const name = String(b?.name || '').trim();
    const m = /^band\s+(\d+)$/i.exec(name);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
    }
  });
  return maxNum > 0 ? maxNum + 1 : ((Array.isArray(bands) ? bands.length : 0) + 1);
}

const GenericBandBuilder = ({
  bands,
  setBands,
  maxHz = 20000,
  isEditable = true,
  allowReorder = true
}) => {
  const safeBands = Array.isArray(bands) ? bands : [];
  const [draftHz, setDraftHz] = React.useState({});
  const [draftGain, setDraftGain] = React.useState({});
  const [draggingBandId, setDraggingBandId] = React.useState(null);
  const gainRafRef = React.useRef({});
  const gainPendingRef = React.useRef({});

  React.useEffect(() => {
    const bandIds = new Set(safeBands.map((b) => b.id));
    setDraftHz((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => {
        const id = k.split(':')[0];
        if (bandIds.has(id)) next[k] = prev[k];
      });
      return next;
    });
  }, [safeBands]);

  React.useEffect(() => () => {
    Object.values(gainRafRef.current).forEach((rafId) => cancelAnimationFrame(rafId));
    gainRafRef.current = {};
    gainPendingRef.current = {};
  }, []);

  const addBand = () => {
    if (!isEditable) return;
    const nextIdx = nextBandOrdinal(safeBands);
    const id = `b${Date.now()}`;
    const maxLimit = Math.max(MIN_BAND_WIDTH_HZ, toFiniteNumber(maxHz, 20000));
    const lastHigh = toFiniteNumber(safeBands[safeBands.length - 1]?.high, 80);
    const proposedLow = clamp(lastHigh, 0, Math.max(0, maxLimit - MIN_BAND_WIDTH_HZ));
    const proposedHigh = Math.min(maxLimit, proposedLow + 500);
    const range = normalizeBandRange(proposedLow, proposedHigh, maxLimit);

    setBands([
      ...safeBands,
      { id, name: `Band ${nextIdx}`, low: range.low, high: range.high, gain: 1 }
    ]);
  };

  const removeBand = (id) => {
    if (!isEditable) return;
    setBands(safeBands.filter((b) => b.id !== id));
  };

  const moveBand = (index, direction) => {
    if (!allowReorder) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= safeBands.length) return;
    const next = [...safeBands];
    const temp = next[index];
    next[index] = next[newIndex];
    next[newIndex] = temp;
    setBands(next);
  };

  const moveBandToIndex = (sourceId, targetIndex) => {
    if (!allowReorder) return;
    const fromIndex = safeBands.findIndex((b) => b.id === sourceId);
    if (fromIndex < 0 || targetIndex < 0 || targetIndex >= safeBands.length || fromIndex === targetIndex) {
      return;
    }
    const reordered = [...safeBands];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setBands(reordered);
  };

  const update = (id, patch) => {
    setBands(
      safeBands.map((b) => {
        if (b.id !== id) return b;
        const lowInput = patch.low != null ? toFiniteNumber(patch.low, Number(b.low)) : Number(b.low);
        const highInput = patch.high != null ? toFiniteNumber(patch.high, Number(b.high)) : Number(b.high);
        const gain = patch.gain != null ? toFiniteNumber(patch.gain, Number(b.gain)) : Number(b.gain);
        const range = normalizeBandRange(lowInput, highInput, maxHz);
        return {
          ...b,
          ...patch,
          low: range.low,
          high: range.high,
          gain: clamp(gain, 0, 2)
        };
      })
    );
  };

  const scheduleGainCommit = (id, value) => {
    gainPendingRef.current[id] = value;
    if (gainRafRef.current[id]) return;

    gainRafRef.current[id] = requestAnimationFrame(() => {
      const nextValue = gainPendingRef.current[id];
      if (typeof nextValue === 'number') {
        update(id, { gain: nextValue });
      }
      setDraftGain((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete gainPendingRef.current[id];
      delete gainRafRef.current[id];
    });
  };

  const flushGainCommit = (id) => {
    const existingRaf = gainRafRef.current[id];
    if (existingRaf) {
      cancelAnimationFrame(existingRaf);
      delete gainRafRef.current[id];
    }

    const value = (id in gainPendingRef.current) ? gainPendingRef.current[id] : draftGain[id];
    if (typeof value !== 'number') return;

    delete gainPendingRef.current[id];
    update(id, { gain: value });
    setDraftGain((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const draftKey = (id, field) => `${id}:${field}`;

  const setDraft = (id, field, value) => {
    const k = draftKey(id, field);
    setDraftHz((prev) => ({ ...prev, [k]: value }));
  };

  const clearDraft = (id, field) => {
    const k = draftKey(id, field);
    setDraftHz((prev) => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const commitDraftHz = (id, field, fallbackValue) => {
    if (!isEditable) return;
    const k = draftKey(id, field);
    const raw = draftHz[k];
    if (raw == null) return;

    const parsed = Number(raw);
    update(id, { [field]: Number.isFinite(parsed) ? parsed : fallbackValue });
    clearDraft(id, field);
  };

  const getDisplayHz = (band, field) => {
    const k = draftKey(band.id, field);
    return k in draftHz ? draftHz[k] : String(band[field]);
  };

  const getDisplayGain = (bandId, committedGain) => {
    const gainValue = Number(draftGain[bandId] ?? committedGain);
    return Number.isFinite(gainValue) ? gainValue : 1;
  };

  const title = isEditable ? 'Custom Bands' : 'Band Controls';
  const subtitle = isEditable
    ? 'Add subdivisions and control location, width and gain (0 -> 2)'
    : 'Adjust individual band gains (0 -> 2)';
  const lockFrequencyRange = !isEditable;

  return (
    <div className="generic-builder">
      <div className="generic-builder-head">
        <div>
          <div className="generic-builder-title">{title}</div>
          <div className="generic-builder-subtitle">{subtitle}</div>
        </div>
        {isEditable && <button type="button" className="btn btn-small" onClick={addBand}>Add band</button>}
      </div>

      <div className="generic-band-list">
        {safeBands.length === 0 && (
          <div className="helper-text" style={{ marginTop: '0.3rem' }}>
            No bands configured. Use Add band to start.
          </div>
        )}
        {safeBands.map((b, idx) => {
          const safeGainValue = getDisplayGain(b.id, b.gain);
          return (
            <div
              key={b.id}
              className="generic-band"
              draggable={allowReorder && safeBands.length > 1}
              onDragStart={(e) => {
                if (!allowReorder) return;
                setDraggingBandId(b.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', b.id);
              }}
              onDragOver={(e) => {
                if (!allowReorder) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                if (!allowReorder) return;
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain') || draggingBandId;
                moveBandToIndex(draggedId, idx);
                setDraggingBandId(null);
              }}
              onDragEnd={() => setDraggingBandId(null)}
              style={{ opacity: draggingBandId === b.id ? 0.6 : 1 }}
            >
              <div className="generic-band-top">
                <div className="generic-band-name" title={allowReorder ? 'Drag to reorder' : ''}>
                  {allowReorder ? ':: ' : ''}{b.name}
                </div>
                {(allowReorder || isEditable) && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {allowReorder && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => moveBand(idx, -1)}
                          disabled={idx === 0}
                          title="Move Up"
                          style={{ opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        >
                          ^
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => moveBand(idx, 1)}
                          disabled={idx === safeBands.length - 1}
                          title="Move Down"
                          style={{ opacity: idx === safeBands.length - 1 ? 0.3 : 1, cursor: idx === safeBands.length - 1 ? 'not-allowed' : 'pointer' }}
                        >
                          v
                        </button>
                      </>
                    )}
                    {isEditable && (
                      <button type="button" className="icon-btn" onClick={() => removeBand(b.id)} title="Remove">Delete</button>
                    )}
                  </div>
                )}
              </div>

              <div className="generic-band-grid">
                <label className="field">
                  <span>Low (Hz)</span>
                  <input
                    type="number"
                    value={getDisplayHz(b, 'low')}
                    min={0}
                    max={maxHz}
                    onChange={(e) => {
                      if (!lockFrequencyRange) setDraft(b.id, 'low', e.target.value);
                    }}
                    onBlur={() => {
                      if (!lockFrequencyRange) commitDraftHz(b.id, 'low', Number(b.low));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    readOnly={lockFrequencyRange}
                    disabled={lockFrequencyRange}
                  />
                </label>
                <label className="field">
                  <span>High (Hz)</span>
                  <input
                    type="number"
                    value={getDisplayHz(b, 'high')}
                    min={0}
                    max={maxHz}
                    onChange={(e) => {
                      if (!lockFrequencyRange) setDraft(b.id, 'high', e.target.value);
                    }}
                    onBlur={() => {
                      if (!lockFrequencyRange) commitDraftHz(b.id, 'high', Number(b.high));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    readOnly={lockFrequencyRange}
                    disabled={lockFrequencyRange}
                  />
                </label>
                <label className="field gain-field">
                  <span>Gain</span>
                  <div className="gain-row">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={safeGainValue}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setDraftGain((prev) => ({ ...prev, [b.id]: next }));
                        scheduleGainCommit(b.id, next);
                      }}
                      onPointerUp={() => flushGainCommit(b.id)}
                      onMouseUp={() => flushGainCommit(b.id)}
                      onTouchEnd={() => flushGainCommit(b.id)}
                    />
                    <span className="gain-pill">{safeGainValue.toFixed(2)}x</span>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GenericBandBuilder;
