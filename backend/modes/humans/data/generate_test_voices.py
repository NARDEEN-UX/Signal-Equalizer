import numpy as np
from scipy.signal import butter, lfilter
from scipy.io.wavfile import write
import os

fs = 44100

# --- Functions ---
def voice_source(F0, t):
    return (
        1*np.sin(2*np.pi*F0*t) +
        0.5*np.sin(2*np.pi*2*F0*t) +
        0.3*np.sin(2*np.pi*3*F0*t) +
        0.2*np.sin(2*np.pi*4*F0*t)
    )

def bandpass(data, low, high):
    b,a = butter(2,[low/(fs/2),high/(fs/2)],btype='band')
    return lfilter(b,a,data)

# --- Folders ---
output_dir = "backend/modes/humans/data/wav"
os.makedirs(output_dir, exist_ok=True)

# --- New frequency bands (non-overlapping) ---
# Elderly: 50-350 Hz (fundamental ~100 Hz)
# Adult Male: 350-900 Hz (fundamental ~120 Hz)
# Child: 900-1500 Hz (fundamental ~300 Hz)
# Adult Female: 1500-4000 Hz (fundamental ~200 Hz)

# --- File 1: sequential voices (separate) ---
duration_each = 4
t1 = np.linspace(0, duration_each, duration_each*fs)

elderly = bandpass(voice_source(100, t1), 50, 350)
male = bandpass(voice_source(120, t1), 350, 900)
child = bandpass(voice_source(300, t1), 900, 1500)
female = bandpass(voice_source(200, t1), 1500, 4000)

signal1 = np.concatenate([elderly, male, child, female])
signal1 = signal1 / np.max(np.abs(signal1))

file1 = os.path.join(output_dir, "voices_sequential.wav")
write(file1, fs, (signal1 * 32767).astype(np.int16))

# --- File 2: mixed voices (all together) ---
duration2 = 4
t2 = np.linspace(0, duration2, duration2*fs)

elderly = bandpass(voice_source(100, t2), 50, 350)
male = bandpass(voice_source(120, t2), 350, 900)
child = bandpass(voice_source(300, t2), 900, 1500)
female = bandpass(voice_source(200, t2), 1500, 4000)

signal2 = elderly + male + child + female
signal2 = signal2 / np.max(np.abs(signal2))

file2 = os.path.join(output_dir, "voices_mixed.wav")
write(file2, fs, (signal2 * 32767).astype(np.int16))

# --- File 3: test all voices at once with different gains ---
duration3 = 4
t3 = np.linspace(0, duration3, duration3*fs)

elderly_test = 0.5 * bandpass(voice_source(100, t3), 50, 350)      # reduced
male_test = 1.0 * bandpass(voice_source(120, t3), 350, 900)        # full
child_test = 0.7 * bandpass(voice_source(300, t3), 900, 1500)      # reduced
female_test = 1.0 * bandpass(voice_source(200, t3), 1500, 4000)    # full

signal3 = elderly_test + male_test + child_test + female_test
signal3 = signal3 / np.max(np.abs(signal3))

file3 = os.path.join(output_dir, "voices_mixed_test.wav")
write(file3, fs, (signal3 * 32767).astype(np.int16))

print(f"Test WAV files generated successfully:")
print(f"1) {file1}")
print(f"2) {file2}")
print(f"3) {file3}")
print(f"\nFrequency bands:")
print(f"  Elderly:       50-350 Hz")
print(f"  Adult Male:    350-900 Hz")
print(f"  Child:         900-1500 Hz")
print(f"  Adult Female:  1500-4000 Hz")
