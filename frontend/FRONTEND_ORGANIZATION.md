# Frontend Organization Structure

## Overview
The frontend is now organized by **modes** with a **services layer** for backend communication. This structure allows multiple team members to work on different modes' backends independently while maintaining a single unified UI.

## Directory Structure

```
src/
├── config/                          # Global configuration
│   └── modes.js                     # All mode definitions and utilities
├── services/                        # Centralized backend communication
│   ├── api.js                       # Generic API service
│   └── modes.js                     # Index of all mode services
├── modes/                           # Mode-specific logic
│   ├── human/
│   │   ├── config.js               # Human mode configuration
│   │   └── humanService.js         # Human mode API calls
│   ├── animal/
│   │   ├── config.js               # Animal mode configuration
│   │   └── animalService.js        # Animal mode API calls
│   ├── music/
│   │   ├── config.js               # Music mode configuration
│   │   └── musicService.js         # Music mode API calls
│   ├── ecg/
│   │   ├── config.js               # ECG mode configuration
│   │   └── ecgService.js           # ECG mode API calls
│   └── generic/
│       ├── config.js               # Generic mode configuration
│       └── genericService.js       # Generic mode API calls
├── components/                      # React components
│   ├── shared/                      # Shared components
│   ├── AudioUploader.jsx
│   ├── WaveformViewer.jsx
│   ├── FFTChart.jsx
│   ├── SpectrogramViewer.jsx
│   ├── WaveletChart.jsx
│   ├── SliderGroup.jsx
│   ├── TransportControls.jsx
│   ├── ModeSelector.jsx
│   ├── ModeModal.jsx
│   ├── EqualizerCurve.jsx
│   └── ... (other components)
├── mock/                            # Mock data for development
│   └── useMockProcessing.js
├── App.jsx                          # Main app component
├── App.css
├── index.css
└── main.jsx
```

## How It Works

### 1. **Mode Selection** (Same UI for all modes)
The UI shows all modes in the mode selector. When a user selects a mode, the following happens:
- UI displays the correct slider labels from the mode config
- Correct frequency bands are loaded
- Right service is called for backend processing

### 2. **Team Member Workflow**

Each team member works on their mode's backend:

#### Human Mode Team
- File: `/frontend/src/modes/human/humanService.js`
- Endpoint: `POST /api/modes/human/process`
- Configure: `/frontend/src/modes/human/config.js`

#### Animal Mode Team
- File: `/frontend/src/modes/animal/animalService.js`
- Endpoint: `POST /api/modes/animal/process`
- Configure: `/frontend/src/modes/animal/config.js`

#### Music Mode Team
- File: `/frontend/src/modes/music/musicService.js`
- Endpoint: `POST /api/modes/music/process`
- Configure: `/frontend/src/modes/music/config.js`

#### ECG Mode Team
- File: `/frontend/src/modes/ecg/ecgService.js`
- Endpoint: `POST /api/modes/ecg/process`
- Configure: `/frontend/src/modes/ecg/config.js`

### 3. **Adding Backend Endpoints**

To add your mode's backend endpoints:

```javascript
// In modes/{yourMode}/{yourMode}Service.js

export const yourModeService = {
  processAudio: async (audioData, sliderValues) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/modes/yourMode/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioData, sliders: sliderValues })
      });
      return await response.json();
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  },

  // Add your specific endpoints below
  yourCustomEndpoint: async (data) => {
    // Your implementation
  }
};
```

### 4. **Using Services in Components**

```javascript
// In any component
import { humanModeService } from '@/services/modes';
import { getModeConfig } from '@/config/modes';

const modeConfig = getModeConfig('human');
const result = await humanModeService.processAudio(audio, sliders);
```

### 5. **Shared Configuration**

The `src/config/modes.js` file contains all mode definitions. When a mode is selected:
- Slider labels update automatically
- Frequency bands are set correctly
- Sample rate and wavelet params are loaded

## Communication Protocol

Each mode's service uses this standard structure:

**Request:**
```json
{
  "audio": "ArrayBuffer or base64",
  "sliders": [0.5, 0.3, 0.8, 0.2],
  "mode": "human"
}
```

**Response:**
```json
{
  "success": true,
  "processed": "ArrayBuffer or base64",
  "fft": [...],
  "wavelet": [...],
  "metadata": {...}
}
```

## Backend Integration Checklist

For each team member:

- [ ] Create your mode's backend endpoint in Flask
- [ ] Update `{mode}Service.js` with correct endpoint URL
- [ ] Test `processAudio` function with your backend
- [ ] Add mode-specific endpoints to your `{mode}Service.js`
- [ ] Update `config.js` if any mode parameters need adjustment
- [ ] Test UI with your mode selected

## Environment Variables

Create a `.env` file in the frontend root:

```
REACT_APP_API_URL=http://localhost:5000
```

## Key Benefits

✓ **Independent Development**: Each team member works on their mode independently
✓ **Single UI**: Users don't see different UIs for different modes
✓ **Easy Integration**: Just add your endpoint to your mode's service file
✓ **Organized Code**: Each mode's logic is in its own folder
✓ **Shared Resources**: Common components and utilities in shared folders
✓ **Scalability**: Easy to add new modes by creating new folders/files
