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

  // If user pushes low to the ceiling, pin to a valid last band [max-1, max].
  if (safeHigh <= safeLow) {
    safeLow = Math.max(0, maxLimit - MIN_BAND_WIDTH_HZ);
    safeHigh = maxLimit;
  }

  return { low: safeLow, high: safeHigh };
}

const DEFAULT_BANDS = [
  { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1 },
  { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1 },
  { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1 },
  { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1 }
];

const GenericBandBuilder = ({ bands, setBands, maxHz = 20000, isEditable = true }) => {
  const safeBands = bands?.length ? bands : DEFAULT_BANDS;
  const [draftHz, setDraftHz] = React.useState({});

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

  const addBand = () => {
    if (!isEditable) return;
    const nextIdx = safeBands.length + 1;
    const id = `b${Date.now()}`;
    const maxLimit = Math.max(MIN_BAND_WIDTH_HZ, toFiniteNumber(maxHz, 20000));
    const lastHigh = toFiniteNumber(safeBands[safeBands.length - 1]?.high, 2000);
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
    if (!isEditable) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= safeBands.length) return;
    const newBands = [...safeBands];
    const temp = newBands[index];
    newBands[index] = newBands[newIndex];
    newBands[newIndex] = temp;
    setBands(newBands);
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

  const title = isEditable ? 'Custom Bands' : 'Band Controls';
  const subtitle = isEditable 
    ? 'Add subdivisions and control location, width and gain (0 → 2)'
    : 'Adjust individual band gains (0 → 2)';

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
        {safeBands.map((b, idx) => (
          <div key={b.id} className="generic-band">
            <div className="generic-band-top">
              <div className="generic-band-name">{b.name}</div>
              {isEditable && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    type="button" 
                    className="icon-btn" 
                    onClick={() => moveBand(idx, -1)} 
                    disabled={idx === 0} 
                    title="Move Up"
                    style={{ opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    ↑
                  </button>
                  <button 
                    type="button" 
                    className="icon-btn" 
                    onClick={() => moveBand(idx, 1)} 
                    disabled={idx === safeBands.length - 1} 
                    title="Move Down"
                    style={{ opacity: idx === safeBands.length - 1 ? 0.3 : 1, cursor: idx === safeBands.length - 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ↓
                  </button>
                  <button type="button" className="icon-btn" onClick={() => removeBand(b.id)} title="Remove">🗑</button>
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
                  onChange={(e) => setDraft(b.id, 'low', e.target.value)}
                  onBlur={() => commitDraftHz(b.id, 'low', Number(b.low))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>High (Hz)</span>
                <input
                  type="number"
                  value={getDisplayHz(b, 'high')}
                  min={0}
                  max={maxHz}
                  onChange={(e) => setDraft(b.id, 'high', e.target.value)}
                  onBlur={() => commitDraftHz(b.id, 'high', Number(b.high))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
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
                    value={b.gain}
                    onChange={(e) => update(b.id, { gain: e.target.value })}
                  />
                  <span className="gain-pill">{Number(b.gain).toFixed(2)}×</span>
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GenericBandBuilder;

