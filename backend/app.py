# app.py – Flask app: CORS, /upload, /process, /save_schema, /load_schema, /sample/human. No UI.
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import soundfile as sf
import os
import json
from dsp import (
    compute_fft, compute_spectrogram,
    apply_freq_equalization,
    compute_wavelet_decomp, apply_wavelet_equalization
)
from modes import get_mode_info

app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = 'temp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

current_signal = None
sample_rate = None

@app.route('/upload', methods=['POST'])
def upload():
    """Handle audio upload and basic validation, return friendly errors instead of crashing."""
    global current_signal, sample_rate

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file in request'}), 400

    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    path = os.path.join(UPLOAD_FOLDER, 'input.wav')
    try:
        file.save(path)
        current_signal, sample_rate = sf.read(path)
        if len(current_signal.shape) > 1:
            current_signal = np.mean(current_signal, axis=1)  # mono
    except Exception as exc:
        # Do not let invalid/corrupted files crash the app
        current_signal = None
        sample_rate = None
        return jsonify({'error': f'Failed to read audio file: {str(exc)}'}), 400

    return jsonify({'message': 'uploaded', 'length': len(current_signal)})

@app.route('/process', methods=['POST'])
def process():
    """Apply equalization and return all data needed for plots, with safe error handling."""
    global current_signal, sample_rate

    if current_signal is None or sample_rate is None:
        return jsonify({'error': 'No audio uploaded yet'}), 400

    try:
        data = request.get_json(force=True, silent=False) or {}
    except Exception as exc:
        return jsonify({'error': f'Invalid JSON payload: {str(exc)}'}), 400

    mode = data.get('mode', 'human')
    sliders_freq = data.get('sliders_freq') or [1, 1, 1, 1]
    sliders_wavelet = data.get('sliders_wavelet') or [1, 1, 1, 1]

    mode_info = get_mode_info(mode)
    if not mode_info:
        return jsonify({'error': f'Unsupported mode: {mode}'}), 400

    # Ensure sliders lengths match configuration to avoid index issues
    num_bands = len(mode_info['freq_bands'])
    if len(sliders_freq) < num_bands:
        sliders_freq = list(sliders_freq) + [1.0] * (num_bands - len(sliders_freq))
    sliders_freq = sliders_freq[:num_bands]

    wavelet_levels = mode_info['wavelet_levels']
    if len(sliders_wavelet) < wavelet_levels:
        sliders_wavelet = list(sliders_wavelet) + [1.0] * (wavelet_levels - len(sliders_wavelet))
    sliders_wavelet = sliders_wavelet[:wavelet_levels]

    try:
        # Apply frequency equalization, then wavelet on top
        output_freq = apply_freq_equalization(
            current_signal, sample_rate, sliders_freq, mode_info['freq_bands']
        )
        output_signal = apply_wavelet_equalization(
            output_freq, sliders_wavelet, mode_info['wavelet'], mode_info['wavelet_levels']
        )

        # Ensure same length as input (some wavelet ops can change length slightly)
        min_len = min(len(current_signal), len(output_signal))
        current = current_signal[:min_len]
        output = output_signal[:min_len]

        # Compute data for plots
        t = np.arange(len(current)) / sample_rate
        fft_freq, fft_mag_in = compute_fft(current, sample_rate)
        _, fft_mag_out = compute_fft(output, sample_rate)

        spec_t, spec_f, spec_in = compute_spectrogram(current, sample_rate)
        _, _, spec_out = compute_spectrogram(output, sample_rate)

        # Wavelet coefficients for display (energy per level)
        coeffs_in = compute_wavelet_decomp(current, mode_info['wavelet'], mode_info['wavelet_levels'])
        coeffs_out = compute_wavelet_decomp(output, mode_info['wavelet'], mode_info['wavelet_levels'])
        energy_in = [float(np.sqrt(np.mean(np.asarray(c) ** 2))) for c in coeffs_in]
        energy_out = [float(np.sqrt(np.mean(np.asarray(c) ** 2))) for c in coeffs_out]

        return jsonify({
            'time': t.tolist(),
            'input_signal': current.tolist(),
            'output_signal': output.tolist(),
            'fft': {
                'freq': fft_freq.tolist(),
                'in': fft_mag_in.tolist(),
                'out': fft_mag_out.tolist()
            },
            'spectrogram': {
                't': spec_t.tolist(),
                'f': spec_f.tolist(),
                'in': spec_in.tolist(),
                'out': spec_out.tolist()
            },
            'wavelet': {
                'levels': list(range(len(energy_in))),
                'in': energy_in,
                'out': energy_out
            }
        })
    except Exception as exc:
        # Any unexpected numerical error is returned as JSON instead of crashing
        return jsonify({'error': f'Processing failed: {str(exc)}'}), 500

@app.route('/save_schema', methods=['POST'])
def save_schema():
    data = request.json
    filename = data['filename']
    with open(os.path.join('schemas', filename), 'w') as f:
        json.dump(data['schema'], f)
    return jsonify({'message': 'saved'})

@app.route('/load_schema', methods=['POST'])
def load_schema():
    filename = request.json['filename']
    with open(os.path.join('schemas', filename), 'r') as f:
        schema = json.load(f)
    return jsonify(schema)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
SAMPLE_HUMAN = os.path.join(DATA_DIR, 'human_sample.wav')

@app.route('/sample/human', methods=['GET'])
def sample_human():
    """Serve generated 4-voice sample for Human mode (run generate_human_sample.py first)."""
    if not os.path.isfile(SAMPLE_HUMAN):
        return jsonify({'error': 'Sample not generated. Run: python backend/generate_human_sample.py'}), 404
    return send_file(SAMPLE_HUMAN, mimetype='audio/wav', as_attachment=False)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
