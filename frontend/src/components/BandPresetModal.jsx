import React, { useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'signal_equalizer_band_presets_v1';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toNum(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeBand(raw, index) {
  const low = Math.max(0, toNum(raw?.low, 0));
  const high = Math.max(low + 1, toNum(raw?.high, low + 200));
  const gain = clamp(toNum(raw?.gain, 1), 0, 2);

  return {
    id: String(raw?.id || `band-${index + 1}-${makeId()}`),
    name: String(raw?.name || `Band ${index + 1}`),
    low,
    high,
    gain
  };
}

function normalizePreset(raw, fallbackMode = 'generic') {
  const mode = String(raw?.mode || fallbackMode);
  const name = String(raw?.name || `Preset ${new Date().toLocaleDateString()}`).trim();
  const sourceBands = Array.isArray(raw?.bands) ? raw.bands : [];
  const bands = sourceBands.map((b, i) => normalizeBand(b, i));

  if (!name || bands.length === 0) return null;

  return {
    id: String(raw?.id || makeId()),
    name,
    mode,
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    bands
  };
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizePreset(item))
      .filter(Boolean)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

function persistPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

const BandPresetModal = ({ open, onClose, activeModeId, bands, onApplyPreset }) => {
  const [name, setName] = useState('');
  const [presets, setPresets] = useState(() => loadPresets());
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const importRef = useRef(null);

  const modePresets = useMemo(
    () => presets.filter((p) => p.mode === activeModeId),
    [presets, activeModeId]
  );

  if (!open) return null;

  const refresh = (nextPresets) => {
    setPresets(nextPresets);
    persistPresets(nextPresets);
  };

  const handleSaveNew = () => {
    setError('');
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a preset name first.');
      return;
    }

    const normalizedBands = (Array.isArray(bands) ? bands : [])
      .map((b, i) => normalizeBand(b, i));

    if (!normalizedBands.length) {
      setError('No bands available to save.');
      return;
    }

    const preset = normalizePreset({
      id: makeId(),
      name: trimmed,
      mode: activeModeId,
      createdAt: new Date().toISOString(),
      bands: normalizedBands
    }, activeModeId);

    if (!preset) {
      setError('Unable to save preset.');
      return;
    }

    const nextPresets = [preset, ...presets].slice(0, 150);
    refresh(nextPresets);
    setName('');
    setSelectedId(preset.id);
  };

  const handleLoadSelected = () => {
    setError('');
    const preset = modePresets.find((p) => p.id === selectedId);
    if (!preset) {
      setError('Select a preset to load.');
      return;
    }
    onApplyPreset(preset);
    onClose();
  };

  const handleDelete = (id) => {
    const next = presets.filter((p) => p.id !== id);
    refresh(next);
    if (selectedId === id) setSelectedId('');
  };

  const triggerImport = () => {
    importRef.current?.click();
  };

  const handleImportFile = async (e) => {
    setError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedRaw = Array.isArray(parsed) ? parsed : [parsed];

      const normalized = importedRaw
        .map((item) => normalizePreset(item, activeModeId))
        .filter(Boolean)
        .map((item) => ({ ...item, id: makeId() }));

      if (!normalized.length) {
        setError('No valid presets found in file.');
        return;
      }

      const next = [...normalized, ...presets].slice(0, 150);
      refresh(next);
      setSelectedId(normalized[0].id);
    } catch {
      setError('Invalid JSON file.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card band-preset-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 className="modal-title">Band Presets ({activeModeId})</h3>
            <p className="modal-subtitle">Save and load complete band configurations (min/max + gain).</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="band-preset-actions">
          <div className="band-preset-save-row">
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Preset name"
            />
            <button type="button" className="btn" onClick={handleSaveNew}>Save New</button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLoadSelected}
              disabled={!modePresets.length}
            >
              Load Selected
            </button>
          </div>
          <div className="band-preset-import-row">
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button type="button" className="btn btn-ghost" onClick={triggerImport}>Import JSON</button>
          </div>
          {error && <div className="band-preset-error">{error}</div>}
        </div>

        <div className="band-preset-list">
          {modePresets.length === 0 && (
            <div className="band-preset-empty">No saved presets for this mode yet.</div>
          )}
          {modePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`band-preset-item ${selectedId === preset.id ? 'active' : ''}`}
              onClick={() => setSelectedId(preset.id)}
            >
              <div className="band-preset-item-top">
                <div className="band-preset-name">{preset.name}</div>
                <div className="band-preset-right">
                  <span className="band-preset-date">{new Date(preset.createdAt).toLocaleString()}</span>
                  <span
                    className="band-preset-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(preset.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDelete(preset.id);
                      }
                    }}
                    title="Delete"
                  >
                    🗑
                  </span>
                </div>
              </div>
              <div className="band-preset-band-tags">
                {preset.bands.map((b) => (
                  <span key={b.id} className="band-preset-tag">
                    {Math.round(b.low)}-{Math.round(b.high)}Hz ×{Number(b.gain).toFixed(2)}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BandPresetModal;
