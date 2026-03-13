# Frontend Updates Guide

## Changes Summary

The frontend has been updated to support the new backend structure and display requirements for customized modes.

## Key Updates

### 1. Mode Configuration (`src/config/modes.js`)

Each mode now includes:

```javascript
{
  id: 'human',
  name: 'Human Voices',
  // ... other properties
  allowAddSubdivision: false,  // NEW: Controls if "Add Band" button appears
  requirements: [              // NEW: Display preset requirements
    'Male voice',
    'Female voice', 
    'Young speaker',
    'Old speaker'
  ]
}
```

**Mode Definitions:**

| Mode | allowAddSubdivision | Requirements |
|------|-------------------|--------------|
| generic | ✅ true | N/A |
| animal | ❌ false | Bird sounds, Dog barks, Cat meows, Other animal sounds |
| ecg | ❌ false | Normal ECG, Atrial fibrillation, Ventricular tachycardia, Heart block |
| human | ❌ false | Male voice, Female voice, Young speaker, Old speaker |
| music | ❌ false | Bass instrument, Piano, Vocal tracks, Violin |

### 2. App Component (`src/App.jsx`)

#### Updated MODES Array
- Added `allowAddSubdivision` flag to each mode
- Added `requirements` array to customized modes
- Updated slider labels to be more descriptive (e.g., "Male Voice" instead of "Voice 1")

#### New Requirements Display
Added new UI section that displays for customized modes:

```jsx
{activeModeId !== 'generic' && activeMode.requirements && (
  <div className="requirements-box">
    {/* Displays preset requirements */}
  </div>
)}
```

### 3. GenericBandBuilder Component

Already had proper conditional rendering:
- Shows "Add band" button only when `isEditable={true}`
- `isEditable={activeModeId === 'generic'}`
- Other modes show read-only band controls

### 4. Styling (`src/App.css`)

Added new CSS classes for requirements display:

```css
.requirements-box {
  /* Container for requirements section */
  background: rgba(62, 12, 7, 0.4);
  border: 1px solid var(--redNormalHover);
  border-radius: 12px;
  padding: 1.5rem;
}

.requirement-item {
  /* Individual requirement item */
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.requirement-badge {
  /* Number badge (1, 2, 3, 4) */
  min-width: 24px;
  height: 24px;
  background: var(--redNormal);
  border-radius: 50%;
}

.requirement-text {
  /* Requirement description */
  color: var(--redLightActive);
}
```

## User Interface Changes

### For Generic Mode
- **No change** - Still has "Add band" button
- Users can add/remove custom frequency subdivisions
- No requirements display

### For Customized Modes (animal, ecg, human, music)
- **No "Add band" button** - Preset bands are fixed
- **NEW: Requirements section** - Shows what the mode expects
- User can only adjust gain/scale for preset bands
- Bands are read-only (cannot change frequency ranges)

## Frontend-Backend Connection

### API Calls Expected

1. **Get Mode Info:**
   ```
   GET /modes/{mode_id}
   Response includes: slider_labels, freq_bands, requirements
   ```

2. **Process Signal:**
   ```
   POST /modes/{mode_id}/process
   Body: { scales: [1.0, 1.5, ...], use_wavelet: false }
   Response: output_signal, FFT, spectrogram
   ```

3. **Upload Audio:**
   ```
   POST /upload
   Response: length, sample_rate, duration
   ```

### Data Binding

Mode information flows as:
```
Backend config.py 
  → FastAPI endpoint (/modes/{id})  
    → Frontend fetch
      → MODES array update
        → Component rendering
          → UI display
```

## Component Tree

```
App (root)
├── Landing View
│   └── Mode cards (clickable)
├── Workspace View
  ├── Top Menu
  ├── Waveform Viewers (input/output)
  ├── FFT Charts
  ├── Spectrograms
  └── Sidebar
      ├── Mode Selector
      ├── Equalizer Tab
      │   ├── EqualizerCurve
      │   ├── GenericBandBuilder
      │   ├── Requirements Display (NEW)
      │   ├── Band Information
      │   └── SliderGroup
      ├── Wavelet Type Selection
      └── Transport Controls
```

## Development Notes

### Testing Requirements Display

To test the requirements section:
1. Switch to a customized mode (animal, ecg, human, or music)
2. Verify requirements box appears below the band builder
3. Verify requirements are specific to the selected mode
4. Switch to generic mode
5. Verify requirements box disappears

### Updating Requirements

To update requirements for a mode:
1. Edit `src/config/modes.js`
2. Modify the `requirements` array for the mode
3. Backend will need corresponding update in `backend/core/config.py`

## Next Steps for Integration

1. **API Integration:**
   - Update `api.js` to fetch `/modes/{id}` endpoint
   - Use returned requirements in UI

2. **State Management:**
   - Consider moving requirements to backend entirely
   - Sync with backend when switching modes

3. **Validation:**
   - Ensure signal requirements are met before processing
   - Warn user if signal doesn't match mode requirements

4. **Persistence:**
   - Save/load mode-specific presets
   - Remember user's last mode selection

## File Reference

| File | Changes |
|------|---------|
| `src/config/modes.js` | ✅ Updated mode config |
| `src/App.jsx` | ✅ Updated MODES array, added requirements display |
| `src/App.css` | ✅ Added requirements styling |
| `src/components/GenericBandBuilder.jsx` | ✅ No changes (already has isEditable logic) |
| Other components | ✅ No changes needed |
