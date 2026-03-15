import numpy as np
from scipy.signal import butter, lfilter
from scipy.io.wavfile import write
import os

fs = 8000

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

# --- File 1: sequential voices ---
duration_each = 45
t1 = np.linspace(0, duration_each, duration_each*fs)

male = bandpass(voice_source(120, t1),600,1400)
old = bandpass(voice_source(95, t1),350,700)
female = bandpass(voice_source(210, t1),1500,2300)
child = bandpass(voice_source(320, t1),800,1100)

signal1 = np.concatenate([male, old, female, child])
signal1 = signal1 / np.max(np.abs(signal1))

file1 = os.path.join(output_dir, "voices_sequential.wav")
write(file1, fs, (signal1 * 32767).astype(np.int16))

# --- File 2: mixed voices ---
duration2 = 180
t2 = np.linspace(0, duration2, duration2*fs)

male = bandpass(voice_source(120, t2),600,1400)
old = bandpass(voice_source(95, t2),350,700)
female = bandpass(voice_source(210, t2),1500,2300)
child = bandpass(voice_source(320, t2),800,1100)

signal2 = male + old + female + child
signal2 = signal2 / np.max(np.abs(signal2))

file2 = os.path.join(output_dir, "voices_mixed.wav")
write(file2, fs, (signal2 * 32767).astype(np.int16))

print(f"Files saved:\n1) {file1}\n2) {file2}")