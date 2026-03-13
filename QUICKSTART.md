# Quick Start Guide - Running the Application

## Prerequisites

- Python 3.8+
- Node.js 14+
- npm or yarn

## Backend Setup

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**What gets installed:**
- `fastapi` - Modern web framework
- `uvicorn` - ASGI server
- `numpy`, `scipy` - Scientific computing
- `pywavelets` - Wavelet transforms
- `soundfile` - Audio I/O
- `pydantic` - Data validation
- `python-multipart` - Form data handling

### 2. Run FastAPI Server

```bash
# From backend directory
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Output should show:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 3. Verify Backend

Open browser and navigate to:
- **API Docs:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc
- **Root Endpoint:** http://localhost:8000/

You should see:
```json
{
  "message": "Signal Equalizer API",
  "version": "1.0.0"
}
```

## Frontend Setup

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

**Output should show:**
```
  VITE v4.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 3. Open Application

Navigate to http://localhost:5173 in your browser

## Testing the Application

### Basic Workflow

1. **Start Backend (Terminal 1):**
   ```bash
   cd backend
   python -m uvicorn main:app --reload
   ```

2. **Start Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```

3. **In Browser:**
   - Navigate to http://localhost:5173
   - Click on a mode (e.g., "Human Voices")
   - Upload an audio file
   - Adjust sliders to hear the effect
   - Save/load presets

### API Testing

Test the API directly using FastAPI's interactive docs:

1. Go to http://localhost:8000/docs
2. Click "Try it out" on any endpoint
3. Fill in parameters
4. Click "Execute"

**Key endpoints to test:**

- **GET /modes**
  Lists all available modes with requirements

- **POST /upload**
  Upload a WAV file

- **GET /modes/human**
  Get human mode info with requirements

- **POST /modes/human/process**
  Process signal with scales: `[1.0, 1.0, 1.0, 1.0]`

## Testing Checklist

### Backend

- [ ] FastAPI server starts without errors
- [ ] API docs accessible at /docs
- [ ] GET /modes returns all 5 modes with requirements
- [ ] Each mode has correct slider labels
- [ ] Generic mode has no requirements
- [ ] Customized modes have requirements

### Frontend

- [ ] Application loads without console errors
- [ ] Mode selector displays all modes
- [ ] Requirements section visible for customized modes
- [ ] Generic mode shows "Add band" button
- [ ] Other modes do NOT show "Add band" button
- [ ] Switching modes updates the UI correctly

### Integration

- [ ] Can upload audio file
- [ ] Signal info endpoint returns FFT data
- [ ] Can adjust sliders in all modes
- [ ] Output signal changes when sliders move
- [ ] FFT chart updates in real-time
- [ ] Spectrogram displays correctly
- [ ] Can save/load presets (when backend is ready)

## Troubleshooting

### Backend Issues

**Port already in use:**
```bash
# Use different port
python -m uvicorn main:app --reload --port 8001
```

**Module not found errors:**
```bash
# Reinstall dependencies
pip install -r requirements.txt --upgrade
```

**Import errors in endpoints:**
- Check that all `__init__.py` files exist
- Verify directory structure matches documentation
- Check relative imports in endpoint files

### Frontend Issues

**Module not found:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Hot reload not working:**
- Check that `npm run dev` is running
- Verify port 5173 is available

**API connection issues:**
- Check that backend is running on port 8000
- Verify CORS is enabled in FastAPI app (it is by default)
- Check browser console for specific errors

## Directory Structure for Running

```
Signal-Equalizer/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── core/
│   ├── modes/
│   └── temp/
├── frontend/
│   ├── package.json
│   ├── src/
│   └── public/
└── data/
```

## Next Steps

### For Development

1. **Add more modes:** Follow the pattern in `backend/modes/` to add new modes
2. **Extend API:** Add endpoints in mode `endpoints/__init__.py` files
3. **Improve UI:** Enhance components in `frontend/src/components/`
4. **Add tests:** Create test files for backend and frontend

### For Production

1. **Build frontend:** `npm run build` (creates `dist/` folder)
2. **Serve static files:** Use main.py to serve frontend
3. **Set CORS properly:** Restrict origins in production
4. **Add authentication:** Implement user authentication
5. **Database:** Store presets in a real database instead of JSON files

## Useful Commands

```bash
# Backend
cd backend
python -m uvicorn main:app --reload           # Development
python -m uvicorn main:app --host 0.0.0.0   # Production (accessible externally)

# Frontend
cd frontend
npm run dev                    # Development server
npm run build                  # Production build
npm run preview                # Preview production build
npm run lint                   # Check code quality

# Testing
curl http://localhost:8000/modes     # Test if backend is running
curl http://localhost:5173            # Test if frontend is running
```

## Common Curl Examples

```bash
# Get all modes
curl http://localhost:8000/modes

# Get specific mode
curl http://localhost:8000/modes/human

# Get API docs
curl http://localhost:8000/openapi.json
```

## Performance Tips

- Keep `--reload` flag during development
- Turn it off for final testing (use production server)
- Clear browser cache if styles don't update
- Check browser DevTools Network tab for API issues

---

**You're ready to go!** Start both servers and begin working with the Signal Equalizer application.
