import argparse
import numpy as np
from scipy.signal import butter, lfilter
from scipy.io.wavfile import write
import os

fs = 44100

# --- Functions ---

def voice_source(F0, t, harmonics=12):
    """Generate a harmonic voice-like waveform with a controllable number of harmonics.

    The basic vocal source is a periodic waveform at the fundamental frequency F0.
    Higher harmonics are added with decreasing amplitude to simulate natural vocal timbre.
    """
    # Relative harmonic amplitudes (descending) - extendable if harmonics > len(base_amps)
    base_amps = [1.0, 0.5, 0.3, 0.2, 0.15, 0.1, 0.08, 0.06, 0.04, 0.03, 0.02, 0.01]
    amps = base_amps[:harmonics] + [base_amps[-1]] * max(0, harmonics - len(base_amps))

    signal = np.zeros_like(t)
    for idx, amp in enumerate(amps, start=1):
        signal += amp * np.sin(2 * np.pi * F0 * idx * t)

    return signal


def bandpass(data, low, high):
    """Apply a 2nd-order Butterworth bandpass filter."""
    b, a = butter(2, [low / (fs / 2), high / (fs / 2)], btype='band')
    return lfilter(b, a, data)


def make_voice_segment(f0, low, high, duration_sec):
    """Create a single voice segment with harmonic synthesis + bandpass."""
    n = int(fs * duration_sec)
    t = np.linspace(0, duration_sec, n, endpoint=False)
    return bandpass(voice_source(f0, t), low, high)


def normalize(x):
    max_val = np.max(np.abs(x))
    return x / max_val if max_val > 0 else x


def main(duration_each=4, use_full_duration=False):
    """Generate example human voice test signals.

    Args:
        duration_each: Duration in seconds for each voice segment.
        use_full_duration: If True, generate 3-minute (180s) signals as per the spec.
    """

    # Output folder (relative to repo root)
    output_dir = os.path.join(os.path.dirname(__file__), "wav")
    os.makedirs(output_dir, exist_ok=True)

    # Use 45s segments for each voice when using full duration
    if use_full_duration:
        duration_each = 45

    # Basic voice parameters (fundamentals + formant bandpass ranges)
    voices = [
        # name, fundamental (Hz), bandpass low, bandpass high, vowel
        ("Male", 120, 600, 1400, "A"),
        ("Elderly", 95, 350, 700, "U"),
        ("Female", 210, 1500, 2300, "E"),
        ("Child", 320, 800, 1100, "O")
    ]

    # --- Sequential file ---
    segments = []
    for name, f0, low, high, vowel in voices:
        seg = make_voice_segment(f0, low, high, duration_each)
        # Normalize each voice segment so no single voice dominates when we mix.
        segments.append(normalize(seg))

    sequential = np.concatenate(segments)
    sequential = normalize(sequential)

    seq_filename = os.path.join(output_dir, "voices_sequential.wav")
    write(seq_filename, fs, (sequential * 32767).astype(np.int16))

    # --- Mixed file ---
    mixed_segments = []
    duration_mix = duration_each * (len(voices) if use_full_duration else 1)
    n_mix = int(fs * duration_mix)
    t_mix = np.linspace(0, duration_mix, n_mix, endpoint=False)

    for name, f0, low, high, vowel in voices:
        # Each voice covers the full mix duration
        mixed_segments.append(bandpass(voice_source(f0, t_mix), low, high))

    mixed = np.sum(mixed_segments, axis=0)
    mixed = normalize(mixed)

    mix_filename = os.path.join(output_dir, "voices_mixed.wav")
    write(mix_filename, fs, (mixed * 32767).astype(np.int16))

    print("Generated test voice files:")
    print(f"  - Sequential: {seq_filename} ({len(sequential)/fs:.1f}s)")
    print(f"  - Mixed:      {mix_filename} ({len(mixed)/fs:.1f}s)")

    if use_full_duration:
        print("Note: These files are ~3 minutes long and may take a while to load/play.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate synthetic human voice test WAV files.')
    parser.add_argument('--duration-each', type=float, default=4, help='Duration (seconds) for each voice segment (sequential).')
    parser.add_argument('--full', action='store_true', help='Generate full 3-minute files (45s per voice segment).')
    args = parser.parse_args()

    main(duration_each=args.duration_each, use_full_duration=args.full)
