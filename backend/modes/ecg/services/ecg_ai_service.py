"""
ECG AI Classification Service
Uses Pan-Tompkins R-peak detection + spectral energy analysis for reliable
classification on mixed ECG signals.

References:
  - Pan & Tompkins (1985) IEEE TBME
  - PhysioNet MIT-BIH Arrhythmia Database frequency characteristics
  - AHA/ACC/HRS ECG interpretation guidelines
"""

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks
from scipy.fft import fft, ifft, fftfreq
from typing import List, Dict


# ─────────────────────────── Filtering helpers ────────────────────────────

def _bandpass(signal: np.ndarray, fs: float, lo: float, hi: float) -> np.ndarray:
    nyq = fs / 2
    lo_n = max(lo / nyq, 1e-4)
    hi_n = min(hi / nyq, 0.9999)
    b, a = butter(2, [lo_n, hi_n], btype='band')
    return filtfilt(b, a, signal)


def _band_rms(signal: np.ndarray, fs: float, lo: float, hi: float) -> float:
    """RMS energy in a frequency band."""
    filtered = _bandpass(signal, fs, lo, hi)
    return float(np.sqrt(np.mean(filtered ** 2)))


# ──────────────────── Pan-Tompkins R-peak detection ───────────────────────

def detect_r_peaks(signal: np.ndarray, fs: float) -> np.ndarray:
    filtered = _bandpass(signal, fs, 5.0, 15.0)
    h = np.array([1, 2, 0, -2, -1]) * (1 / (8 / fs))
    deriv = np.convolve(filtered, h, mode='same')
    squared = deriv ** 2
    win = max(2, int(0.150 * fs))
    kernel = np.ones(win) / win
    mwi = np.convolve(squared, kernel, mode='same')
    min_dist = max(2, int(0.200 * fs))
    threshold = 0.3 * np.max(mwi)
    peaks, _ = find_peaks(mwi, height=threshold, distance=min_dist)
    snap = max(2, int(0.050 * fs))
    refined = []
    for p in peaks:
        lo = max(0, p - snap)
        hi = min(len(signal) - 1, p + snap)
        refined.append(lo + int(np.argmax(np.abs(signal[lo:hi + 1]))))
    return np.unique(np.array(refined, dtype=int))


# ──────────────────── Feature extraction ──────────────────────────────────

def extract_features(signal: np.ndarray, fs: float) -> Dict:
    """
    Frequency-domain energy features that reliably separate arrhythmia
    components even in a mixed signal.

    Component frequency signatures (from clinical literature):
      Normal QRS:   10-40 Hz  (sharp narrow complex)
      AFib f-waves:  4-9 Hz  (baseline oscillations OUTSIDE QRS windows)
      VTach:        2-15 Hz  (wide QRS, rapid rate → high LF energy)
      HeartBlock:  0.5-3 Hz  (very slow rate → energy at lowest freqs)
    """
    r_peaks = detect_r_peaks(signal, fs)
    n = len(r_peaks)

    # ── RR-based features (use median to be robust against extra beats) ──
    if n >= 3:
        rr_ms = np.diff(r_peaks) / fs * 1000.0
        median_rr = float(np.median(rr_ms))
        hr_bpm = 60000.0 / median_rr if median_rr > 0 else 0.0
        sdnn_ms = float(np.std(rr_ms))
        rmssd = float(np.sqrt(np.mean(np.diff(rr_ms) ** 2)))
        pnn50 = float(np.sum(np.abs(np.diff(rr_ms)) > 50) / max(1, len(rr_ms) - 1) * 100)
        # CoV only over beats within 20% of median (ignore outliers)
        rr_clean = rr_ms[np.abs(rr_ms - median_rr) < 0.4 * median_rr]
        cov_rr = float(np.std(rr_clean) / median_rr) if len(rr_clean) > 2 else 0.0
        dropped_beats = int(np.sum(rr_ms > 1.8 * median_rr))
        dropped_ratio = dropped_beats / max(1, len(rr_ms))
    else:
        hr_bpm = sdnn_ms = rmssd = pnn50 = cov_rr = 0.0
        dropped_beats = 0
        dropped_ratio = 0.0

    # ── QRS width: median width of detected beats ──
    qrs_widths_ms = []
    for p in r_peaks:
        amp = abs(signal[p])
        thresh = 0.4 * amp
        left = right = p
        while left > 0 and abs(signal[left - 1]) > thresh:
            left -= 1
        while right < len(signal) - 1 and abs(signal[right + 1]) > thresh:
            right += 1
        qrs_widths_ms.append((right - left) / fs * 1000.0)
    qrs_width_ms = float(np.median(qrs_widths_ms)) if qrs_widths_ms else 80.0

    # ── Spectral energy in each arrhythmia band ──
    # Blank out QRS windows to isolate baseline (for AFib f-wave detection)
    baseline = signal.copy()
    blank = max(2, int(0.15 * fs))
    for p in r_peaks:
        baseline[max(0, p - blank): p + blank] = 0.0

    # AFib: f-wave energy in 4-9 Hz on the QRS-blanked baseline
    f_wave_energy = _band_rms(baseline, fs, 4.0, 9.0)

    # Overall spectral energies
    e_total  = _band_rms(signal, fs, 0.5, 40.0) or 1e-9
    e_slow   = _band_rms(signal, fs, 0.5, 3.0)    # Heart Block slow rate
    e_fast   = _band_rms(signal, fs, 15.0, 40.0)  # VTach fast rate
    e_qrs    = _band_rms(signal, fs, 8.0, 25.0)   # Normal QRS

    # Normalised ratios
    fwe_ratio  = f_wave_energy / e_total
    slow_ratio = e_slow / e_total
    fast_ratio = e_fast / e_total
    qrs_ratio  = e_qrs / e_total

    return {
        "r_peaks":        r_peaks.tolist(),
        "n_beats":        n,
        "heart_rate_bpm": round(hr_bpm, 1),
        "mean_rr_ms":     round(60000.0 / hr_bpm if hr_bpm > 0 else 0, 1),
        "sdnn_ms":        round(sdnn_ms, 1),
        "rmssd_ms":       round(rmssd, 1),
        "pnn50_pct":      round(pnn50, 1),
        "cov_rr":         round(cov_rr, 4),
        "qrs_width_ms":   round(qrs_width_ms, 1),
        "f_wave_energy":  round(f_wave_energy, 5),
        "dropped_beats":  dropped_beats,
        "dropped_ratio":  round(dropped_ratio, 3),
        # spectral ratios (internal use)
        "_fwe_ratio":     fwe_ratio,
        "_slow_ratio":    slow_ratio,
        "_fast_ratio":    fast_ratio,
        "_qrs_ratio":     qrs_ratio,
    }


# ──────────────────── Pre-trained classifier ──────────────────────────────

def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-float(x)))


def classify(features: Dict) -> Dict:
    """
    One-vs-rest spectral + HRV classifier.
    Primary features: spectral energy ratios (robust on mixed signals).
    Secondary: RR-based HRV (filtered CoV to remove beat-mixture artifacts).
    """
    if "error" in features or features.get("n_beats", 0) < 3:
        return {
            "Normal": 0.5, "Atrial Fib": 0.1, "V-Tach": 0.1, "Heart Block": 0.1,
            "predicted": "Indeterminate", "confidence": 0.0
        }

    hr       = features["heart_rate_bpm"]
    cov      = features["cov_rr"]         # cleaned CoV
    qrs      = features["qrs_width_ms"]
    dr       = features["dropped_ratio"]

    fwe_r    = features["_fwe_ratio"]     # AFib f-wave ratio
    slow_r   = features["_slow_ratio"]    # Heart Block slow-rate ratio
    fast_r   = features["_fast_ratio"]    # VTach fast ratio
    qrs_r    = features["_qrs_ratio"]     # Normal QRS ratio

    # ── Normal ──
    w_normal = (
        qrs_r  * 8.0
        - fwe_r  * 6.0
        - slow_r * 4.0
        - cov    * 5.0
        - dr     * 8.0
        - max(0, hr - 100) * 0.05
        - max(0, 60 - hr)  * 0.05
        + 1.5
    )

    # ── AFib: high f-wave baseline, high CoV, normal-ish HR ──
    w_afib = (
        fwe_r  * 18.0
        + cov   * 8.0
        - slow_r * 3.0
        - 3.5
    )

    # ── VTach: fast rate + high fast-band energy + relatively wide QRS ──
    w_vtach = (
        fast_r * 10.0
        + max(0, hr - 100) * 0.08
        + max(0, qrs - 110) * 0.04
        - fwe_r * 4.0
        - 3.5
    )

    # ── Heart Block: slow rate, dropped beats, high slow-band energy ──
    w_hblock = (
        slow_r * 12.0
        + dr    * 15.0
        + max(0, 60 - hr) * 0.08
        - fast_r * 3.0
        - 4.0
    )

    scores = {
        "Normal":      round(float(_sigmoid(w_normal)), 3),
        "Atrial Fib":  round(float(_sigmoid(w_afib)),   3),
        "V-Tach":      round(float(_sigmoid(w_vtach)),  3),
        "Heart Block": round(float(_sigmoid(w_hblock)), 3),
    }

    predicted = max(scores, key=scores.get)
    return {**scores, "predicted": predicted, "confidence": round(scores[predicted], 3)}


# ──────────────────── Suggested gains ─────────────────────────────────────

def suggest_gains(scores: Dict) -> List[float]:
    labels = ["Normal", "Atrial Fib", "V-Tach", "Heart Block"]
    gains = []
    for label in labels:
        p = scores.get(label, 0.5)
        if label == "Normal":
            gains.append(round(min(2.0, 0.8 + 1.2 * p), 2))
        else:
            gains.append(round(max(0.0, 1.0 - 1.5 * p), 2))
    return gains


# ──────────────────── Public entry point ──────────────────────────────────

def run_ecg_ai(signal: List[float], fs: float = 500.0) -> Dict:
    sig = np.array(signal, dtype=np.float64)
    features = extract_features(sig, fs)
    scores   = classify(features)
    gains    = suggest_gains(scores)

    # Strip internal spectral ratio keys before returning
    public_features = {k: v for k, v in features.items() if not k.startswith('_')}

    # AI output signal: apply suggested gains via frequency windows
    from modes.ecg.services.ecg_service import ECGModeService
    fft_data = fft(sig)
    freqs    = fftfreq(len(sig), 1.0 / fs)
    labels   = ["Normal", "Atrial Fib", "V-Tach", "Heart Block"]
    for i, label in enumerate(labels):
        for lo, hi in ECGModeService.COMPONENT_RANGES.get(label, []):
            mask = (np.abs(freqs) >= lo) & (np.abs(freqs) < hi)
            fft_data[mask] *= gains[i]

    return {
        "features":         public_features,
        "scores":           scores,
        "suggested_gains":  gains,
        "ai_output_signal": np.real(ifft(fft_data)).tolist(),
    }

