# Signal Equalizer

Web app for equalizing audio in **frequency** and **wavelet** domains. Human mode: 4-voice sliders (frequency bands + Haar wavelet). Input/output waveforms, FFT (with audiogram scale), spectrograms.

## Quick start

1. **Backend** (from project root):
   ```bash
   cd backend && pip install -r requirements.txt && python generate_human_sample.py && python app.py
   ```
   (Generates `data/human_sample.wav` once; then runs Flask on port 5000.)

2. **Frontend** (from project root):
   ```bash
   cd frontend && npm install && npm run dev
   ```
   (Vite on port 3000; open http://localhost:3000)

3. In the UI: **Upload** a WAV or click **Load sample (Human)** to use the synthetic 4-voice mix. Adjust frequency and wavelet sliders; output updates live.

## Structure

See **PROJECT_STRUCTURE.md** for the file-by-file layout (front vs back) and what each file does.

## Modes

- **Human mode** (current): 4 sliders in frequency domain + 4 in wavelet (Haar). One combined output.
- Generic and other custom modes (Animal, Medical, Music) to be added later.
