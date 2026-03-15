import React from 'react';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const DEFAULT_BANDS = [
  { id: 'b1', name: 'Band 1', low: 80, high: 180, gain: 1 },
  { id: 'b2', name: 'Band 2', low: 180, high: 300, gain: 1 },
  { id: 'b3', name: 'Band 3', low: 300, high: 3000, gain: 1 },
  { id: 'b4', name: 'Band 4', low: 3000, high: 8000, gain: 1 }
];

const GenericBandBuilder = ({ bands, setBands, maxHz = 20000, isEditable = true }) => {
  const safeBands = bands?.length ? bands : DEFAULT_BANDS;

  const addBand = () => {
    if (!isEditable) return;
    const nextIdx = safeBands.length + 1;
    const id = `b${Date.now()}`;
    const lastHigh = safeBands[safeBands.length - 1]?.high ?? 2000;
    setBands([
      ...safeBands,
      { id, name: `Band ${nextIdx}`, low: clamp(lastHigh, 0, maxHz), high: clamp(lastHigh + 500, 0, maxHz), gain: 1 }
    ]);
  };

  const removeBand = (id) => {
    if (!isEditable) return;
    setBands(safeBands.filter((b) => b.id !== id));
  };

  const update = (id, patch) => {
    setBands(
      safeBands.map((b) => {
        if (b.id !== id) return b;
        const low = patch.low != null ? Number(patch.low) : Number(b.low);
        const high = patch.high != null ? Number(patch.high) : Number(b.high);
        const gain = patch.gain != null ? Number(patch.gain) : Number(b.gain);
        return {
          ...b,
          ...patch,
          low: clamp(low, 0, maxHz),
          high: clamp(Math.max(high, low + 1), 0, maxHz),
          gain: clamp(gain, 0, 2)
        };
      })
    );
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
        {safeBands.map((b) => (
          <div key={b.id} className="generic-band">
            <div className="generic-band-top">
              <div className="generic-band-name">{b.name}</div>
              {isEditable && <button type="button" className="icon-btn" onClick={() => removeBand(b.id)} title="Remove">🗑</button>}
            </div>

            <div className="generic-band-grid">
              <label className="field">
                <span>Low (Hz)</span>
                <input type="number" value={b.low} min={0} max={maxHz} onChange={(e) => update(b.id, { low: e.target.value })} />
              </label>
              <label className="field">
                <span>High (Hz)</span>
                <input type="number" value={b.high} min={0} max={maxHz} onChange={(e) => update(b.id, { high: e.target.value })} />
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

