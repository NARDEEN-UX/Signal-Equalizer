"""
Generate synthetic 4-voice mixture for Human mode testing.
Saves to ../data/human_sample.wav.
Run from backend/: python generate_human_sample.py
"""
import numpy as np
import soundfile as sf
import os

SAMPLE_RATE = 44100
DURATION_SEC = 4.0
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'human_sample.wav')

def make_voice(f0_hz, harmonics_amps, duration_sec, fs, phase_shift=0):
    """One synthetic voice: sum of sines at f0 and harmonics."""
    t = np.arange(0, duration_sec, 1/fs)
    sig = np.zeros_like(t, dtype=float)
    for i, amp in enumerate(harmonics_amps):
        f = f0_hz * (i + 1)
        if f >= fs / 2:
            break
        sig += amp * np.sin(2 * np.pi * f * t + phase_shift)
    return sig / (np.max(np.abs(sig)) + 1e-8) * 0.25

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    n = int(SAMPLE_RATE * DURATION_SEC)
    t = np.arange(n) / SAMPLE_RATE

    # Voice 1: male-like (85–180 Hz band)
    v1 = make_voice(100, [1.0, 0.5, 0.3, 0.2], DURATION_SEC, SAMPLE_RATE, 0)

    # Voice 2: female-like (180–300 Hz band)
    v2 = make_voice(220, [1.0, 0.6, 0.25], DURATION_SEC, SAMPLE_RATE, 0.5)

    # Voice 3: child/young (300–3000 Hz emphasis)
    v3 = make_voice(350, [0.8, 0.7, 0.4, 0.2], DURATION_SEC, SAMPLE_RATE, 1.0)

    # Voice 4: older (3000–8000 Hz presence)
    v4 = make_voice(120, [1.0, 0.4, 0.2] + [0.15]*4, DURATION_SEC, SAMPLE_RATE, 0.2)
    v4_high = make_voice(4000, [0.3, 0.2], DURATION_SEC, SAMPLE_RATE, 0.7)
    v4 = v4 + 0.5 * v4_high
    v4 = v4 / (np.max(np.abs(v4)) + 1e-8) * 0.25

    mix = v1 + v2 + v3 + v4
    mix = mix / (np.max(np.abs(mix)) + 1e-8) * 0.9
    sf.write(OUTPUT_PATH, mix, SAMPLE_RATE)
    print(f"Saved {OUTPUT_PATH} ({DURATION_SEC}s, {SAMPLE_RATE} Hz, 4-voice mix)")

if __name__ == '__main__':
    main()
