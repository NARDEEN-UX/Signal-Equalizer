# Team Setup Guide

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create Environment File**
   Create `.env` in the frontend root directory:
   ```
   REACT_APP_API_URL=http://localhost:5000
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

## For Each Mode Team

### Your Task:
Create the backend API for your mode in the backend folder.

### Your Files to Update:

1. **Backend Implementation**
   - Create your endpoints in `backend/modes/{yourMode}/`
   - Implement processing logic

2. **Frontend Integration**
   - Update `frontend/src/modes/{yourMode}/{yourMode}Service.js`
   - Add/modify the `processAudio` method with correct endpoint
   - Add any additional methods your mode needs

3. **Configuration**
   - Review `frontend/src/modes/{yourMode}/config.js`
   - Update if any parameters need adjustment

4. **Testing**
   - Test with the UI by selecting your mode
   - Verify sliders and output

## API Contract

All mode endpoints should follow this structure:

### Request
```json
POST /api/modes/{mode}/process
{
  "audio": "base64 encoded audio or raw data",
  "sliders": [0.5, 0.3, 0.8, 0.2]
}
```

### Response
```json
{
  "success": true,
  "processed": "base64 encoded processed audio",
  "fft": [...],
  "wavelet": [...],
  "metadata": {
    "duration": 5.2,
    "sampleRate": 44100
  }
}
```

## Project Structure Overview

```
Signal-Equalizer/
├── backend/                  # Your API implementation
│   ├── app.py               # Main Flask app
│   ├── modes/               # Mode-specific logic
│   │   ├── human/
│   │   ├── animal/
│   │   ├── music/
│   │   └── ecg/
│   └── ...
└── frontend/                # React UI (organized by mode)
    ├── src/
    │   ├── modes/          # Mode-specific services
    │   ├── services/       # API communication
    │   ├── config/         # Mode configurations
    │   ├── components/     # Shared React components
    │   └── App.jsx         # Main app
    ├── public/             # Static files
    └── package.json
```

## File Locations Quick Reference

| Task | File |
|------|------|
| View mode config | `src/config/modes.js` |
| Human mode service | `src/modes/human/humanService.js` |
| Animal mode service | `src/modes/animal/animalService.js` |
| Music mode service | `src/modes/music/musicService.js` |
| ECG mode service | `src/modes/ecg/ecgService.js` |
| Generic API service | `src/services/api.js` |

## Questions?

Refer to `FRONTEND_ORGANIZATION.md` for detailed documentation on the structure and how to integrate your backend.
