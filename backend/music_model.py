from demucs import pretrained
from demucs.apply import apply_model
import torchaudio
import soundfile as sf
import numpy as np
import os


def process_multiple_bands(input_path, bands_config, output_dir=None):
    
    try:
        # Validate input
        if not os.path.exists(input_path):
            return {'success': False, 'message': f'File not found: {input_path}'}
        
        if not bands_config:
            return {'success': False, 'message': 'No bands configuration provided'}
        
        # Load audio
        waveform, sr = torchaudio.load(input_path)
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
        
        # Load model and separate
        print("Separating audio into stems...")
        model = pretrained.get_model('htdemucs_6s')
        device = 'cpu'
        waveform = waveform.to(device)
        model = model.to(device)
        
        estimates = apply_model(model, waveform.unsqueeze(0), shifts=2, overlap=0.25, split=True)[0]
        
        # Create estimates dictionary
        estimates_dict = {}
        for source, est in zip(model.sources, estimates):
            est_name = 'violin' if source == 'other' else source
            estimates_dict[est_name] = est.cpu().numpy().transpose(1, 0)
        
        # Stem name mapping
        stem_mapping = {
            'bass': 'bass',
            'drum': 'drums',
            'drums': 'drums',
            'piano': 'piano',
            'violin': 'violin',
            'vocals': 'vocals',
            'guitar': 'guitar'
        }
        
        # Apply gains from bands configuration
        print(f"Applying gains to {len(bands_config)} bands...")
        results = []
        for band in bands_config:
            band_name = band.get("name", "").lower()
            gain_factor = float(band.get("factor", 1.0))
            target_stem = stem_mapping.get(band_name, band_name)
            
            if target_stem in estimates_dict:
                estimates_dict[target_stem] *= gain_factor
                results.append({
                    "band": band_name,
                    "stem": target_stem,
                    "gain": gain_factor,
                    "message": f"{target_stem} processed with gain {gain_factor}"
                })
            else:
                print(f"Warning: Stem not found: {target_stem}")
        
        # Mix all processed stems
        print("Mixing all processed stems...")
        mixed_audio = np.sum(list(estimates_dict.values()), axis=0)
        
        # Normalize if clipping
        max_val = np.max(np.abs(mixed_audio))
        if max_val > 1.0:
            mixed_audio = mixed_audio / max_val * 0.99
        
        # Save final output
        output_directory = output_dir or os.path.dirname(input_path)
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(output_directory, "music_model_output.wav")
        sf.write(output_path, mixed_audio, sr)
        
        print(f"Mixed audio saved to: {output_path}")
        
        return {
            'success': True,
            'message': 'Music model processing complete',
            'output_path': output_path,
            'sample_rate': int(sr),
            'bands_processed': results
        }
        
    except Exception as e:
        return {'success': False, 'message': f'Error: {str(e)}'}



# if __name__ == "__main__":
#     input_file = r"D:\dsp_Equalizer\Equalizer\backend\uploads\music_final.WAV"
    
#     result = separate_and_modify_audio(
#         input_path=input_file,
#         target_stem='drums',
#         gain_factor=1.5,  # 1.5x amplification (or 0.5 for quieter, 0.0 to remove)
#         save_stems=True
#     )
    
#     if result['success']:
#         print(f"✓ {result['message']}")
#         print(f"Output saved to: {result['output_path']}")
#         if 'stems_paths' in result:
#             print("Individual stems saved:")
#             for stem, path in result['stems_paths'].items():
#                 print(f"  - {stem}: {path}")
#     else:
#         print(f"✗ {result['message']}")

