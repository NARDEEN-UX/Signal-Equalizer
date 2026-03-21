"""
ECG AI Diagnosis Service
========================
Architecture matches EXACTLY the training notebook:
  stem  : Conv1d(1,32,k=15) + BN + ReLU + MaxPool1d(2)
  block1: ResBlock1D(32,64,   stride=2, dropout=0.2)
  block2: ResBlock1D(64,128,  stride=2, dropout=0.2)
  block3: ResBlock1D(128,256, stride=2, dropout=0.2)  ← GradCAM layer
  pool  : AdaptiveAvgPool1d(1)
  head  : Linear(256,128) + ReLU + Dropout(0.4) + Linear(128,4)

WAV input: resampled to 360 Hz, then analysed exactly like the notebook.
"""

from __future__ import annotations

import math
import os
from collections import Counter
from typing import Any, Dict, List, Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from scipy.fft import rfft, rfftfreq
from scipy.signal import find_peaks, resample_poly

# ── Constants ─────────────────────────────────────────────────────────────────
_MODEL_PATH  = os.path.join(os.path.dirname(__file__), "../../../models/ecg_resnet_mitbih.pth")
_WINDOW_SIZE = 650       # samples at 360 Hz  (~1.8 s)
_TARGET_SR   = 360       # Hz the model was trained at
_HOP_SIZE    = 180       # 0.5 s hop for sliding window
_NUM_CLASSES = 4
_LABELS      = ["Normal", "AFib", "VTach", "HeartBlock"]


# ── Model — exact copy of training notebook ───────────────────────────────────

class ResBlock1D(nn.Module):
    def __init__(self, ch_in: int, ch_out: int, kernel: int = 7,
                 stride: int = 2, dropout: float = 0.2):
        super().__init__()
        pad = kernel // 2
        self.conv1 = nn.Conv1d(ch_in, ch_out, kernel, stride=stride,
                               padding=pad, bias=False)
        self.bn1   = nn.BatchNorm1d(ch_out)
        self.conv2 = nn.Conv1d(ch_out, ch_out, kernel, padding=pad, bias=False)
        self.bn2   = nn.BatchNorm1d(ch_out)
        self.drop  = nn.Dropout(dropout)
        self.skip  = nn.Sequential(
            nn.Conv1d(ch_in, ch_out, 1, stride=stride, bias=False),
            nn.BatchNorm1d(ch_out),
        ) if ch_in != ch_out or stride != 1 else nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = self.drop(F.relu(self.bn1(self.conv1(x))))
        h = self.bn2(self.conv2(h))
        return F.relu(h + self.skip(x))


class ECGResNet(nn.Module):
    def __init__(self, n_classes: int = 4):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv1d(1, 32, kernel_size=15, padding=7, bias=False),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.MaxPool1d(2),
        )
        self.block1 = ResBlock1D(32,  64,  stride=2)
        self.block2 = ResBlock1D(64,  128, stride=2)
        self.block3 = ResBlock1D(128, 256, stride=2)   # GradCAM target
        self.pool   = nn.AdaptiveAvgPool1d(1)
        self.head   = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(128, n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.stem(x)
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        return self.head(self.pool(x))

    def forward_cam(self, x: torch.Tensor):
        """Returns (feature_map, logits) for GradCAM."""
        x    = self.stem(x)
        x    = self.block1(x)
        x    = self.block2(x)
        feat = self.block3(x)            # (1, 256, T')
        out  = self.head(self.pool(feat))
        return feat, out


# ── Lazy singleton ────────────────────────────────────────────────────────────
_MODEL: Optional[ECGResNet] = None


def _load_model() -> ECGResNet:
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    path = os.path.abspath(_MODEL_PATH)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Model not found at {path}. "
            "Train in Kaggle and copy ecg_resnet_mitbih.pth to backend/models/"
        )

    m = ECGResNet(n_classes=_NUM_CLASSES)
    ckpt = torch.load(path, map_location="cpu")
    if isinstance(ckpt, dict):
        state = ckpt.get("model_state_dict", ckpt.get("state_dict", ckpt))
    else:
        state = ckpt
    m.load_state_dict(state, strict=True)
    m.eval()
    _MODEL = m
    return _MODEL


# ── Signal helpers ────────────────────────────────────────────────────────────

def _resample(sig: np.ndarray, from_sr: int, to_sr: int = _TARGET_SR) -> np.ndarray:
    if from_sr == to_sr:
        return sig.astype(np.float32)
    g = math.gcd(int(from_sr), int(to_sr))
    return resample_poly(sig, int(to_sr) // g, int(from_sr) // g).astype(np.float32)


def _normalise(seg: np.ndarray) -> np.ndarray:
    mu, sigma = seg.mean(), seg.std()
    return (seg - mu) / (sigma + 1e-8)


def _pad_or_crop(seg: np.ndarray, size: int = _WINDOW_SIZE) -> np.ndarray:
    if len(seg) >= size:
        start = (len(seg) - size) // 2
        return seg[start:start + size]
    pad = size - len(seg)
    return np.pad(seg, (pad // 2, pad - pad // 2))


# ── GradCAM — matches notebook exactly ───────────────────────────────────────

def _gradcam(model: ECGResNet, seg_norm: np.ndarray) -> np.ndarray:
    """
    GradCAM on block3.conv2.
    Falls back to mean activation if gradients vanish (VTach/HeartBlock fix).
    Returns array of length _WINDOW_SIZE, values in [0,1].
    """
    x = torch.tensor(seg_norm[np.newaxis, np.newaxis, :],
                     dtype=torch.float32)
    acts, grads = {}, {}

    h1 = model.block3.conv2.register_forward_hook(
        lambda m, i, o: acts.update({"f": o}))
    h2 = model.block3.conv2.register_full_backward_hook(
        lambda m, gi, go: grads.update({"g": go[0]}))

    feat, logits = model.forward_cam(x)
    model.zero_grad()
    pred_idx = int(logits.argmax(dim=1).item())
    logits[0, pred_idx].backward()

    h1.remove(); h2.remove()

    act  = acts["f"].squeeze(0)              # (C, T')
    grad = grads["g"].squeeze(0)             # (C, T')
    cam  = F.relu((grad.mean(dim=1, keepdim=True) * act).sum(dim=0))

    # Fallback if gradients vanished
    if cam.max() < 1e-6:
        cam = F.relu(act.mean(dim=0))

    cam = cam - cam.min()
    if cam.max() > 1e-6:
        cam = cam / cam.max()

    cam_np = cam.detach().numpy()
    # Upsample to window size
    return np.interp(
        np.linspace(0, 1, _WINDOW_SIZE),
        np.linspace(0, 1, len(cam_np)),
        cam_np,
    ).astype(np.float64)


# ── Frequency importance — matches notebook ───────────────────────────────────

def _freq_importance(seg: np.ndarray, cam: np.ndarray,
                     sr: int = _TARGET_SR, top_k: int = 3) -> List[Dict]:
    N     = len(seg)
    freqs = rfftfreq(N, 1.0 / sr)[:N // 2]
    fi    = np.zeros(N // 2, dtype=np.float32)
    win   = int(0.5 * sr)
    hop   = win // 4
    pos   = 0
    while pos + win <= N:
        sw  = seg[pos:pos + win] * np.hanning(win)
        cw  = float(cam[pos:pos + win].mean())
        fw  = np.abs(rfft(sw))[:win // 2]
        fw2 = rfftfreq(win, 1.0 / sr)[:win // 2]
        fi += np.interp(freqs, fw2, fw) * cw
        pos += hop

    valid      = (freqs >= 0.5) & (freqs <= 40.0)
    fi[~valid] = 0.0
    fi_s       = np.convolve(fi, np.ones(7) / 7, mode="same")
    peaks, _   = find_peaks(fi_s, height=fi_s.max() * 0.15,
                             distance=max(1, int(0.3 / (freqs[1] - freqs[0]))))
    if len(peaks) == 0:
        peaks = np.argsort(fi_s)[-top_k:]
    order    = np.argsort(fi_s[peaks])[::-1][:top_k]
    top_p    = peaks[order]
    top_vals = fi_s[top_p]
    top_pct  = top_vals / (top_vals[0] + 1e-8) * 100
    return [
        {"hz":         round(float(freqs[p]), 2),
         "bpm":        int(round(float(freqs[p]) * 60)),
         "importance": round(float(pct), 1)}
        for p, pct in zip(top_p, top_pct)
    ]


# ── Time importance ───────────────────────────────────────────────────────────

def _time_importance(cam: np.ndarray, sr: int = _TARGET_SR,
                     top_k: int = 3) -> List[Dict]:
    smooth   = np.convolve(cam, np.ones(15) / 15, mode="same")
    peaks, _ = find_peaks(smooth, height=smooth.max() * 0.3)
    if len(peaks) == 0:
        peaks = np.argsort(smooth)[-top_k:]
    order = np.argsort(smooth[peaks])[::-1][:top_k]
    return [
        {"time_s":     round(float(peaks[order[i]]) / sr, 2),
         "activation": round(float(smooth[peaks[order[i]]]) / (smooth.max() + 1e-12) * 100, 1)}
        for i in range(min(top_k, len(order)))
    ]


# ── Per-window analysis ───────────────────────────────────────────────────────

def _analyse_window(model: ECGResNet, seg_raw: np.ndarray) -> Dict[str, Any]:
    seg  = _normalise(_pad_or_crop(seg_raw))
    x    = torch.tensor(seg[np.newaxis, np.newaxis, :], dtype=torch.float32)

    with torch.no_grad():
        logits = model(x)
        probs  = F.softmax(logits, dim=1).squeeze().numpy()

    pred_idx   = int(probs.argmax())
    confidence = float(probs[pred_idx])
    cam        = _gradcam(model, seg)
    freq_info  = _freq_importance(seg, cam)
    time_info  = _time_importance(cam)

    # FFT for this segment (0–40 Hz)
    N      = len(seg)
    freqs  = rfftfreq(N, 1.0 / _TARGET_SR)
    mags   = np.abs(rfft(seg))
    valid  = (freqs > 0.1) & (freqs <= 40)
    step   = max(1, valid.sum() // 500)

    return {
        "probs":      probs.tolist(),
        "pred_idx":   pred_idx,
        "confidence": confidence,
        "cam":        cam.tolist(),
        "freq_info":  freq_info,
        "time_info":  time_info,
        "fft_freqs":  freqs[valid][::step].tolist(),
        "fft_mags":   mags[valid][::step].tolist(),
    }


# ── Carrier demodulation ─────────────────────────────────────────────────────
# Detects if the signal is a 440 Hz carrier-modulated WAV (from Cell B)
# and extracts the ECG envelope back.

def _demodulate_if_needed(sig: np.ndarray, sr: int = _TARGET_SR) -> np.ndarray:
    """
    Detects carrier-modulated ECG (sin(2π×440×t) × envelope) and extracts
    the envelope back so the model sees raw ECG morphology.

    Detection: if >40% of signal energy is in the 420-460 Hz band → modulated.
    Demodulation: rectify + low-pass filter at 45 Hz to get the envelope,
                  then re-centre to zero mean.
    """
    from scipy.signal import butter, filtfilt
    from scipy.fft import rfft, rfftfreq

    N      = len(sig)
    freqs  = rfftfreq(N, 1.0 / sr)
    mags   = np.abs(rfft(sig.astype(np.float64)))

    # Check energy fraction around 440 Hz carrier band
    total_energy     = (mags ** 2).sum() + 1e-12
    carrier_mask     = (freqs >= 400) & (freqs <= 480)
    carrier_energy   = (mags[carrier_mask] ** 2).sum()
    carrier_fraction = carrier_energy / total_energy

    if carrier_fraction < 0.15:
        # Not a carrier-modulated signal — return as-is
        return sig

    # Demodulate: extract amplitude envelope
    # Step 1: rectify (absolute value)
    rectified = np.abs(sig.astype(np.float64))

    # Step 2: low-pass filter at 40 Hz to extract ECG envelope
    # (ECG energy is 0.05–40 Hz, carrier harmonics are at 880+ Hz)
    nyq    = sr / 2.0
    cutoff = 40.0 / nyq
    b, a   = butter(4, cutoff, btype='low')
    envelope = filtfilt(b, a, rectified).astype(np.float32)

    # Step 3: recover ECG from envelope
    # envelope = 0.3 + 0.7 * ecg_norm  →  ecg_norm = (envelope - 0.3) / 0.7
    ecg_recovered = (envelope - 0.3) / 0.7

    # Step 4: re-centre (remove DC offset)
    ecg_recovered = ecg_recovered - ecg_recovered.mean()

    return ecg_recovered.astype(np.float32)


# ── Main analyser ─────────────────────────────────────────────────────────────

class ECGAIAnalyzer:

    def analyze(self, signal: List[float], sample_rate: int) -> Dict[str, Any]:
        model = _load_model()

        sig = np.array(signal, dtype=np.float32)
        sr  = int(sample_rate) if sample_rate and sample_rate > 0 else _TARGET_SR

        # ── Demodulate ONLY if signal came from a WAV file (carrier-modulated) ─
        # CSV files are uploaded at 360 Hz (raw ECG) — no demodulation needed.
        # WAV files from Cell B are at 44100 Hz with 440 Hz carrier modulation.
        # We detect this by sample rate: 360 Hz = raw CSV, anything else = WAV.
        if sr != _TARGET_SR:
            sig = _demodulate_if_needed(sig, sr)

        # Resample to 360 Hz (same as notebook)
        sig360    = _resample(sig, sr, _TARGET_SR)
        duration  = len(sig360) / _TARGET_SR
        is_long   = duration >= 5.0

        # ── SHORT signal (<5 s) ───────────────────────────────────────────────
        if not is_long:
            w          = _analyse_window(model, sig360)
            pred_label = _LABELS[w["pred_idx"]]
            return {
                "pred_label":     pred_label,
                "confidence":     round(w["confidence"] * 100, 2),
                "probabilities":  {_LABELS[i]: round(float(w["probs"][i]) * 100, 2)
                                   for i in range(_NUM_CLASSES)},
                "freq_importance": w["freq_info"],
                "time_importance": w["time_info"],
                "gradcam":         w["cam"],
                "fft_freqs":       w["fft_freqs"],
                "fft_magnitudes":  w["fft_mags"],
                "is_long":         False,
            }

        # ── LONG signal (≥5 s) — sliding window ──────────────────────────────
        n         = len(sig360)
        positions = range(0, max(1, n - _WINDOW_SIZE + 1), _HOP_SIZE)
        windows_out  = []
        all_probs    = np.zeros(_NUM_CLASSES, dtype=np.float64)
        class_votes  = []
        hz_bucket: Dict[float, float] = {}

        cam_sum = np.zeros(n, dtype=np.float32)
        cam_cnt = np.zeros(n, dtype=np.float32)

        for start in positions:
            end = min(start + _WINDOW_SIZE, n)
            w   = _analyse_window(model, sig360[start:end])

            start_t = round(start / _TARGET_SR, 3)
            end_t   = round(end   / _TARGET_SR, 3)

            windows_out.append({
                "start_t":    start_t,
                "end_t":      end_t,
                "mid_t":      round((start_t + end_t) / 2, 3),
                "pred":       _LABELS[w["pred_idx"]],
                "confidence": round(w["confidence"] * 100, 2),
                "probs":      [round(float(p) * 100, 2) for p in w["probs"]],
                "cam":        w["cam"],
                "freq_info":  w["freq_info"],
                "time_info":  [{"time_s": t["time_s"] + start_t,
                                "activation": t["activation"]}
                               for t in w["time_info"]],
            })

            all_probs   += np.array(w["probs"], dtype=np.float64)
            class_votes.append(w["pred_idx"])

            # CAM timeline
            cam_arr = np.array(w["cam"], dtype=np.float32)
            e_real  = start + len(cam_arr)
            cam_sum[start:e_real] += cam_arr
            cam_cnt[start:e_real] += 1.0

            # Aggregate freq importance
            for fi in w["freq_info"]:
                key = round(fi["hz"] * 2) / 2
                hz_bucket[key] = hz_bucket.get(key, 0.0) + fi["importance"]

        n_win      = len(windows_out)
        avg_probs  = (all_probs / max(1, n_win)).tolist()
        dominant_idx = Counter(class_votes).most_common(1)[0][0]
        dominant     = _LABELS[dominant_idx]

        # CAM timeline (downsampled to 4000 pts)
        cam_tl  = cam_sum / np.maximum(cam_cnt, 1.0)
        cam_tl  = (cam_tl - cam_tl.min()) / (cam_tl.max() + 1e-8)
        step    = max(1, len(cam_tl) // 4000)
        cam_timeline = cam_tl[::step].tolist()

        # Global freq importance top-6
        global_freq = sorted(
            [{"hz": hz, "bpm": int(round(hz * 60)),
              "total_importance": round(imp, 1)}
             for hz, imp in hz_bucket.items()],
            key=lambda x: -x["total_importance"]
        )[:6]

        # Time importance peaks top-5
        peaks, _ = find_peaks(cam_tl, height=0.4,
                              distance=int(0.4 * _TARGET_SR))
        if len(peaks) == 0:
            peaks = np.argsort(cam_tl)[-5:]
        order = np.argsort(cam_tl[peaks])[::-1][:5]
        time_peaks = [
            {"time_s":     round(float(peaks[order[i]]) / _TARGET_SR, 2),
             "activation": round(float(cam_tl[peaks[order[i]]]) * 100, 1)}
            for i in range(len(order))
        ]

        # FFT of full signal
        freqs_f = rfftfreq(len(sig360), 1.0 / _TARGET_SR)
        mags_f  = np.abs(rfft(sig360.astype(np.float32)))
        valid   = (freqs_f > 0.1) & (freqs_f <= 40)
        fstep   = max(1, valid.sum() // 1000)

        # Best window for short-compat fields
        best = max(windows_out, key=lambda w: w["confidence"])

        return {
            # Short-signal compatible
            "pred_label":      dominant,
            "confidence":      round(float(avg_probs[dominant_idx]) * 100, 2),
            "probabilities":   {_LABELS[i]: round(float(avg_probs[i]) * 100, 2)
                                for i in range(_NUM_CLASSES)},
            "freq_importance": global_freq[:3],
            "time_importance": time_peaks[:3],
            "gradcam":         best["cam"],
            "fft_freqs":       freqs_f[valid][::fstep].tolist(),
            "fft_magnitudes":  mags_f[valid][::fstep].tolist(),
            "is_long":         True,
            # Long-signal extras
            "windows":                windows_out,
            "dominant_class":         dominant,
            "window_count":           n_win,
            "mean_probabilities":     {_LABELS[i]: round(float(avg_probs[i]) * 100, 2)
                                       for i in range(_NUM_CLASSES)},
            "global_freq_importance": global_freq,
            "cam_timeline":           cam_timeline,
            "time_importance_peaks":  time_peaks,
        }


# module-level singleton
ecg_ai_analyzer = ECGAIAnalyzer()