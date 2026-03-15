from flask import Blueprint, request, jsonify, Response
import time, json
from mode import BaseMode
import numpy as np
from music_model import process_multiple_bands
from human_model import separate_speech

fft_bp = Blueprint("fft_bp", __name__)

audio_processor = None


@fft_bp.route("/upload", methods=["POST"])
def upload_data():
    global audio_processor
    
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        audio_processor = BaseMode()
        
        data, fs = audio_processor.get_data(file)
       
        # Flatten multi-channel if needed
        if data.ndim > 1:
            data_mono = data.mean(axis=1)
        else:
            data_mono = data
        
        duration = len(data_mono) / fs
        
        response = {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "sample_rate": int(fs),
            "duration": float(duration),
            "samples": int(len(data_mono)),
            "channels": int(data.ndim) if data.ndim > 1 else 1
        }
      
        return jsonify(response), 200

    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

#________________________________________________________________________________________

def generate_fft_averaged(mag, freqs):
  
    N_chunks = mag.shape[0]
    print(f"Processing {N_chunks} chunks for averaging")
    
    # Compute average magnitude across all chunks
    avg_magnitude = np.mean(mag, axis=0)
    
    # Yield the averaged result as a single chunk
    averaged_dict = {
        "freqs": freqs.tolist(),
        "magnitude": avg_magnitude.tolist(),
        "chunk_count": int(N_chunks),
        "is_averaged": True
    }
    yield f"data: {json.dumps(averaged_dict)}\n\n"
    time.sleep(0.1)
    
    yield "event: complete\ndata: {}\n\n"



@fft_bp.route("/fft", methods=["GET", "POST"])
def compute_fft():
    
    try:
        data_type = request.args.get('type', 'input')
        
        # Check if audio data is loaded
        if audio_processor is None:
            error_msg = "No audio data loaded."
            print(f"FFT Error: {error_msg} - audio_processor is None")
            return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")
        
        if audio_processor.data is None or audio_processor.fs is None:
            error_msg = "No audio data loaded. Please upload a file first"
            print(f"FFT Error: {error_msg}")
            print(f"  audio_processor.data is None: {audio_processor.data is None}")
            print(f"  audio_processor.fs is None: {audio_processor.fs is None}")
            return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")

        # Compute FFT based on data type
        try:
            if data_type == 'output' and hasattr(audio_processor, 'reconstructed') and audio_processor.reconstructed is not None:
                # Temporarily use reconstructed data for FFT
                original_data = audio_processor.data
                audio_processor.data = audio_processor.reconstructed
                _, mag, freqs = audio_processor.compute_fft()
                audio_processor.data = original_data  # Restore original
                print(f"FFT computed from OUTPUT data - mag shape: {mag.shape}, freqs shape: {freqs.shape}")
            else:
                # Use original input data
                _, mag, freqs = audio_processor.compute_fft()
                print(f"FFT computed from INPUT data - mag shape: {mag.shape}, freqs shape: {freqs.shape}")
                
        except Exception as compute_err:
            error_msg = f"FFT failed: {str(compute_err)}"
            print(f"FFT Error: {error_msg}")
            return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")

        return Response(generate_fft_averaged(mag, freqs), mimetype="text/event-stream")
    
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"FFT Error: {error_msg}")
        import traceback
        print(traceback.format_exc())
        return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")
#______________________________________________________________________________________

@fft_bp.route("/process_all", methods=["POST"])
def process_all_bands():
    """Process ALL bands at once - frontend sends complete bands list"""
    try:
        if audio_processor is None or audio_processor.data is None:
            error_msg = "No audio data loaded. Please upload a file first"
            return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")

        content = request.get_json() if request.is_json else {}
        bands = content.get("bands", [])
        
        print(f"Processing {len(bands)} bands at once")
        
        # Ensure FFT is computed
        if not audio_processor.fft_computed:
            audio_processor.compute_fft()
        
        # Process all bands at once
        modified_freq_data = audio_processor.process_all_bands(bands)  # in class
        
        modified_mag = np.abs(modified_freq_data) / audio_processor.N
        if modified_mag.ndim == 1:
            modified_mag = modified_mag.reshape(1, -1)
        
        return Response(generate_fft_averaged(modified_mag, audio_processor.freqs), mimetype="text/event-stream")

    except Exception as e:
        error_msg = f"Error processing bands: {str(e)}"
        print(f"Process error: {error_msg}")
        import traceback
        print(traceback.format_exc())
        return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")


#______________________________________________________________________________________
def generate_reconstructed_signal(reconstructed_signal, fs):
    
    # Normalize the reconstructed signal to [-1, 1] range
    max_amplitude = np.max(np.abs(reconstructed_signal))
    if max_amplitude > 0:
        normalized_signal = reconstructed_signal / max_amplitude
    else:
        normalized_signal = reconstructed_signal
    
    # Create time array
    time_array = np.arange(len(normalized_signal)) / fs
    
    # Yield the reconstructed signal data (normalized)
    signal_dict = {
        "time": time_array.tolist(),
        "amplitude": normalized_signal.tolist(),
        "duration": float(len(normalized_signal) / fs),
        "sample_rate": int(fs),
        "samples": int(len(normalized_signal)),
        "data_type": "output"
    }
    yield f"data: {json.dumps(signal_dict)}\n\n"
    time.sleep(0.1)
    
    # Send completion signal
    yield "event: complete\ndata: {}\n\n"

#______________________________________________________________________________________
@fft_bp.route("/reconstruct", methods=["GET", "POST"])
def reconstruct_output():
    try:
        # PRIORITY 1: Check if we already have reconstructed audio (from AI mode)
        # AI models set this directly, so use it first
        if hasattr(audio_processor, 'reconstructed') and audio_processor.reconstructed is not None:
            reconstructed_signal = audio_processor.reconstructed
            print(f"Using pre-reconstructed audio (AI mode) - length: {len(reconstructed_signal)}")
        # PRIORITY 2: Check if we have modified frequency data to reconstruct from (manual mode)
        elif hasattr(audio_processor, 'modified_freq_data') and audio_processor.modified_freq_data is not None:
            try:
                reconstructed_signal = audio_processor.reconstruct()
                print(f"Reconstructed from frequency data (manual mode) - length: {len(reconstructed_signal)}")
            except Exception as reconstruct_err:
                error_msg = f"Signal reconstruction failed: {str(reconstruct_err)}"
                print(f"Reconstruct Error: {error_msg}")
                return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")
        else:
            error_msg = "No processed signal available. Please process the signal first"
            print(f"Reconstruct Error: {error_msg}")
            return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")
        
        # Stream the reconstructed signal via SSE
        return Response(
            generate_reconstructed_signal(reconstructed_signal, audio_processor.fs), 
            mimetype="text/event-stream"
        )
    
    except Exception as e:
        error_msg = f"Unexpected error in reconstruction: {str(e)}"
        print(f"Reconstruct Error: {error_msg}")
        import traceback
        print(traceback.format_exc())
        return Response(f"data: {json.dumps({'error': error_msg})}\n\n", mimetype="text/event-stream")

#_________________________________________________________________________________________________________
@fft_bp.route("/save-config", methods=["POST"])
def save_config():
    try:
        request_data = request.get_json()
        preset = request_data.get("preset", "animal")
        data = request_data.get("data", {})
        
        config_files = {
            "animal": "../src/components/animal_equalizer.json",
            "human": "../src/components/human_equalizer.json",
            "music": "../src/components/music_equalizer.json"
        }
        
        file_path = config_files.get(preset)
        if not file_path:
            return jsonify({"error": f"Unknown preset: {preset}"}), 400
        
        import os
        full_path = os.path.join(os.path.dirname(__file__), file_path)
        
        with open(full_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        return jsonify({"message": f"Configuration saved to {os.path.basename(full_path)}"}), 200
    
    except Exception as e:
        print(f"Error saving config: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"Failed to save: {str(e)}"}), 500


#______________________________________________________________________________________
@fft_bp.route("/spectrogram", methods=["GET", "POST"])
def compute_spectrogram():
   
    try:
        # Check request type
        request_type = request.args.get('type', 'input')
        
        # Select which audio to compute spectrogram from
        if request_type == 'output':
            # Use reconstructed audio if available
            if audio_processor is None or not hasattr(audio_processor, 'reconstructed') or audio_processor.reconstructed is None:
                error_msg = "No reconstructed signal available. Please process and reconstruct first"
                print(f"Spectrogram Error: {error_msg}")
                return jsonify({"error": error_msg}), 400
            audio_data = audio_processor.reconstructed
        else:
            # Use original audio (default)
            if audio_processor is None or audio_processor.data is None or audio_processor.fs is None:
                error_msg = "No audio data loaded. Please upload a file first"
                print(f"Spectrogram Error: {error_msg}")
                return jsonify({"error": error_msg}), 400
            audio_data = audio_processor.data

        # Compute STFT with parameters for good time-frequency resolution
        try:
            from total import STFT
            window_size = 2048  # Good balance between time and frequency resolution
            hop_size = 512      # 75% overlap between windows
            
            stft_matrix, freqs, times = STFT(
                audio_data,
                audio_processor.fs,
                window_size=window_size,
                hop_size=hop_size
            )
            
            print(f"STFT ({request_type}) computed - matrix shape: {stft_matrix.shape}")
            
        except Exception as compute_err:
            error_msg = f"STFT computation failed: {str(compute_err)}"
            print(f"Spectrogram Error: {error_msg}")
            import traceback
            print(traceback.format_exc())
            return jsonify({"error": error_msg}), 500

        # Apply log scaling and normalization for better visualization
        # Add small epsilon to avoid log(0)
        mag_log = np.log10(stft_matrix + 1e-10)
        
        # Normalize to 0-1 range
        mag_min = np.min(mag_log)
        mag_max = np.max(mag_log)
        if mag_max > mag_min:
            mag_normalized = (mag_log - mag_min) / (mag_max - mag_min)
        else:
            mag_normalized = np.zeros_like(mag_log)
        
        # Prepare spectrogram data
        spec_dict = {
            "time": times.tolist(),
            "freqs": freqs.tolist(),
            "magnitude": mag_normalized.tolist(),  # 2D array: time x frequency (normalized)
            "duration": float(len(audio_data) / audio_processor.fs),
            "sample_rate": int(audio_processor.fs)
        }
        
        return jsonify(spec_dict), 200
    
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"Spectrogram Error: {error_msg}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500

#______________________________________________________________________________________
@fft_bp.route("/music_model", methods=["POST"])
def music_model_process():
    try:
        # Check if audio processor has data
        if audio_processor is None or audio_processor.data is None:
            return jsonify({"error": "No audio data loaded. Please upload a file first"}), 400
        
        # Get request parameters - expecting bands array from music_equalizer.json
        content = request.get_json() if request.is_json else {}
        bands = content.get("bands", [])
        
        if not bands:
            return jsonify({"error": "No bands data provided"}), 400
        
        import os
        from scipy.io import wavfile
        
        # Create temporary file with uploaded audio
        temp_dir = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_input = os.path.join(temp_dir, "temp_music_input.wav")
        wavfile.write(temp_input, audio_processor.fs, audio_processor.data)
        
        # Use process_multiple_bands function from music_model
        result = process_multiple_bands(
            input_path=temp_input,
            bands_config=bands,
            output_dir=temp_dir
        )
        
        if not result['success']:
            return jsonify({"error": result.get('message', 'Processing failed')}), 500
        
        # Load the output back into audio_processor
        output_path = result.get('output_path')
        if output_path and os.path.exists(output_path):
            sr, output_audio = wavfile.read(output_path)
            
            # Convert to mono if stereo
            if output_audio.ndim > 1:
                output_audio = output_audio.mean(axis=1)
            
            audio_processor.data = output_audio

            audio_processor.reconstructed = output_audio
            audio_processor.fft_computed = False  # Force recompute FFT with AI output
            audio_processor.modified_freq_data = None  # Clear so /reconstruct uses AI output
            
            print(f"Loaded music model output into data and reconstructed")
        
        return jsonify(result), 200
        
    except Exception as e:
        error_msg = f"Music model processing error: {str(e)}"
        print(error_msg)
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500

#______________________________________________________________________________________
@fft_bp.route("/human_model", methods=["POST"])
def human_model_process():
    try:
        # Check if audio processor has data
        if audio_processor is None or audio_processor.data is None:
            return jsonify({"error": "No audio data loaded. Please upload a file first"}), 400
        
        # Get request parameters - expecting bands array from human_equalizer.json
        content = request.get_json() if request.is_json else {}
        bands = content.get("bands", [])
        
        import os
        from scipy.io import wavfile
        
        # Create temporary file with uploaded audio
        temp_dir = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_input = os.path.join(temp_dir, "temp_human_input.wav")
        wavfile.write(temp_input, audio_processor.fs, audio_processor.data)
        
        # Use separate_speech function from human_model with bands configuration
        result = separate_speech(
            input_path=temp_input,
            bands_config=bands,
            output_dir=temp_dir
        )
        
        if not result['success']:
            return jsonify({"error": result.get('message', 'Processing failed')}), 500
        
        # Load the output back into audio_processor (same as music_model)
        output_path = result.get('output_path')
        if output_path and os.path.exists(output_path):
            sr, output_audio = wavfile.read(output_path)
            
            # Convert to mono if stereo
            if output_audio.ndim > 1:
                output_audio = output_audio.mean(axis=1)
            
            # Convert to float if needed
            if output_audio.dtype != np.float32 and output_audio.dtype != np.float64:
                output_audio = output_audio.astype(np.float32) / np.iinfo(output_audio.dtype).max
            
            audio_processor.reconstructed = output_audio
            audio_processor.fs = sr  # Update sample rate (human model uses 8kHz)
            audio_processor.fft_computed = False  # Force recompute FFT with AI output
            audio_processor.modified_freq_data = None  # Clear so /reconstruct uses AI output
            
            print(f"Loaded human model output into reconstructed - sr: {sr}, length: {len(output_audio)}")
        
        return jsonify(result), 200
        
    except Exception as e:
        error_msg = f"Human model processing error: {str(e)}"
        print(error_msg)
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": error_msg}), 500