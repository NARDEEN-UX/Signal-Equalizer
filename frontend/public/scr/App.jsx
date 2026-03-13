import React, { useState, useEffect } from 'react';
import AudioUploader from './components/AudioUploader';
import ModeSelector from './components/ModeSelector';
import WaveformViewer from './components/WaveformViewer';
import SliderGroup from './components/SliderGroup';
import FFTChart from './components/FFTChart';
import WaveletChart from './components/WaveletChart';
import SpectrogramViewer from './components/SpectrogramViewer';
import TransportControls from './components/TransportControls';
import AudiogramToggle from './components/AudiogramToggle';
import { uploadAudio, processSignals, saveSchema, loadSchema } from './api';

function App() {
  const [mode, setMode] = useState('human');
  const [audioFile, setAudioFile] = useState(null);
  const [signalData, setSignalData] = useState(null);
  const [freqSliders, setFreqSliders] = useState([1, 1, 1, 1]);
  const [waveletSliders, setWaveletSliders] = useState([1, 1, 1, 1]);
  const [audiogram, setAudiogram] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  // Upload file and then process
  useEffect(() => {
    if (audioFile) {
      uploadAudio(audioFile).then(() => handleProcess());
    }
  }, [audioFile]);

  // Re-process when sliders or mode change
  useEffect(() => {
    if (audioFile) {
      handleProcess();
    }
  }, [mode, freqSliders, waveletSliders]);

  const handleProcess = async () => {
    try {
      const res = await processSignals(mode, freqSliders, waveletSliders);
      setSignalData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Playback simulation (simplified – you can use Web Audio API)
  const handlePlay = () => {
    setIsPlaying(true);
    // In a real implementation, you'd create an AudioBuffer and schedule playback
  };
  const handlePause = () => setIsPlaying(false);
  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };
  const handleSpeedChange = (speed) => {
    // adjust playback rate
  };

  return (
    <div className="app">
      <header>
        <h1>Human Voices</h1>
        {audioFile && <span className="file-name">{audioFile.name}</span>}
        <div className="controls-row">
        <AudioUploader onFileSelect={setAudioFile} currentFileName={audioFile?.name} />
        <ModeSelector mode={mode} setMode={setMode} />
        <button onClick={() => saveSchema('human_mode_example.json', { mode, sliders_freq: freqSliders, sliders_wavelet: waveletSliders })}>
          Save Schema
        </button>
        <button className="btn" onClick={() => loadSchema('human_mode_example.json').then(res => {
          const d = res.data;
          if (d.mode) setMode(d.mode);
          if (d.sliders_freq) setFreqSliders(d.sliders_freq);
          if (d.sliders_wavelet) setWaveletSliders(d.sliders_wavelet);
        }).catch(() => {})}>
          Load Schema
        </button>
        </div>
      </header>

      <div className="viewers">
        <div className="viewer-card input-style">
          <WaveformViewer
            title="Input Signal"
            data={signalData?.input_signal}
            time={signalData?.time}
            playbackTime={playbackTime}
            variant="input"
          />
        </div>
        <div className="viewer-card output-style">
          <WaveformViewer
            title="Output Signal"
            data={signalData?.output_signal}
            time={signalData?.time}
            playbackTime={playbackTime}
            variant="output"
          />
        </div>
      </div>

      <TransportControls
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSpeedChange={handleSpeedChange}
      />

      <div className="eq-section">
        <h2>Frequency Domain Equalizer</h2>
        <SliderGroup
          count={4}
          labels={['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4']}
          values={freqSliders}
          onChange={setFreqSliders}
        />
        <div className="plot-row">
          <FFTChart data={signalData?.fft} audiogram={audiogram} />
          <AudiogramToggle checked={audiogram} onChange={setAudiogram} />
        </div>
      </div>

      <div className="eq-section">
        <h2>Wavelet Domain Equalizer (Haar)</h2>
        <SliderGroup
          count={4}
          labels={['Voice 1', 'Voice 2', 'Voice 3', 'Voice 4']}
          values={waveletSliders}
          onChange={setWaveletSliders}
        />
        <WaveletChart data={signalData?.wavelet} />
      </div>

      <div className="spectrograms">
        <button onClick={() => setShowSpec(!showSpec)}>
          Toggle Spectrograms
        </button>
        {showSpec && signalData && (
          <div className="spec-container">
            <SpectrogramViewer
              title="Input"
              times={signalData.spectrogram.t}
              freqs={signalData.spectrogram.f}
              magnitudes={signalData.spectrogram.in}
            />
            <SpectrogramViewer
              title="Output"
              times={signalData.spectrogram.t}
              freqs={signalData.spectrogram.f}
              magnitudes={signalData.spectrogram.out}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;