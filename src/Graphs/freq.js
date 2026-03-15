import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import "../CSS_files/fourier.css";
import {
  FFT_SCALES,
  FFT_SCALE_LABELS,
  DEFAULT_FFT_SCALE,
  PLOT_STYLE,
} from "../utils/audioControls";

const { darkColor, purpleColor, gridColor, axisColor } = PLOT_STYLE;

// Helper function to find max without spreading (avoid stack overflow)
const getMax = (array) => {
  if (!array || array.length === 0) return 0;
  let max = array[0];
  for (let i = 1; i < array.length; i++) {
    if (array[i] > max) max = array[i];
  }
  return max;
};

export default function FFT({ 
  title, 
  audioFile, 
  themeColor = purpleColor, 
  frequencyRange, 
  scalingFactor, 
  processedData, 
  onSetMaxFrequency,
  type = "input", // NEW: "input" or "output"
  outputData = null // NEW: for output FFT data
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputFFTData, setInputFFTData] = useState(null);
  const [frequencyScale, setFrequencyScale] = useState(DEFAULT_FFT_SCALE);

  // Compute FFT only for input type when audioFile changes
  useEffect(() => {
    if (type === "input" && audioFile) {
      computeFFT();
    }
  }, [audioFile, type]);

  // Clear input data when audioFile is removed
  useEffect(() => {
    if (!audioFile && type === "input") {
      setInputFFTData(null);
      setError(null);
    }
  }, [audioFile, type]);

  const computeFFT = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use EventSource for streaming FFT data
      const eventSource = new EventSource("http://localhost:5000/fft");
      console.log("EventSource opened for FFT");

      eventSource.onmessage = (event) => {
        try {
          const jsonData = JSON.parse(event.data);
          console.log("Received message:", jsonData);
          
          // Check if this is an error
          if (jsonData.error) {
            setError(jsonData.error);
            eventSource.close();
            setIsLoading(false);
            return;
          }
          
          // Check if this is the averaged FFT result
          if (jsonData.freqs && jsonData.magnitude) {
            setInputFFTData(jsonData);
            setIsLoading(false);
            console.log(`Received FFT data - ${jsonData.is_averaged ? 'averaged' : 'chunk'} from ${jsonData.chunk_count || 1} chunks`);
        
            if (jsonData.freqs && jsonData.freqs.length > 0) {
              const maxFreq = getMax(jsonData.freqs);
              if (onSetMaxFrequency) {
                onSetMaxFrequency(maxFreq);
              }
            }
          }
        } catch (parseErr) {
          console.error("Error parsing event data:", parseErr);
        }
      };

      eventSource.addEventListener("complete", () => {
        eventSource.close();
        setIsLoading(false);
        console.log("FFT computation completed");
      });

      eventSource.onerror = (err) => {
        eventSource.close();
        setError("Failed to compute FFT - Connection error");
        setIsLoading(false);
        console.error("EventSource error:", err);
      };

    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      console.error("FFT Error:", err);
    }
  };

  // Determine which data to display based on type
  const displayData = type === "input" ? inputFFTData : (processedData || outputData);

  // Convert FFT magnitude to hearing level in dB HL (audiogram style)
  const convertToHearingLevel = (magnitude) => {
    if (!magnitude || magnitude.length === 0) return [];
    const epsilon = 1e-10;
    return magnitude.map((mag) => {
      const value = Math.max(Math.abs(mag), epsilon);
      const db = 20 * Math.log10(value);
      return Math.min(125, Math.max(-10, db));
    });
  };

  //______________________________________________________________________________________
  return (
    <div className="fft-container">
      <h2 className="fft-title">{title}</h2>

      {/* Scale Toggle Button */}
      {displayData && (
        <div className="scale-controls">
          {Object.values(FFT_SCALES).map((scale) => (
            <button
              key={scale}
              onClick={() => setFrequencyScale(scale)}
              className={`btn btn-scale ${frequencyScale === scale ? 'active' : ''}`}
              title={`Switch to ${FFT_SCALE_LABELS[scale]}`}
            >
              {FFT_SCALE_LABELS[scale]}
            </button>
          ))}
        </div>
      )}

     
      
      {isLoading && type === "input" && (
        <div className="fft-loading">
          <div className="loading-spinner"></div>
          <p>Computing FFT...</p>
        </div>
      )}

      
      {error && type === "input" && (
        <div className="fft-error">
          <p>❌ Error: {error}</p>
        </div>
      )}


      {/* plot*/}
      {displayData && (
        <Plot
          data={[
            {
              x: displayData.freqs,
              y: frequencyScale === FFT_SCALES.LOG
                ? convertToHearingLevel(displayData.magnitude)
                : displayData.magnitude,
              type: "scatter",
              mode: "lines",
              line: { color: themeColor, width: 2 },
              fill: "tozeroy",
              fillcolor: `${themeColor}33`,
              name: "Magnitude"
            }
          ]}
          layout={{
            plot_bgcolor: darkColor,
            paper_bgcolor: darkColor,
            font: { color: themeColor },
            xaxis: {
              title: "Frequency (Hz)",
              color: themeColor,
              gridcolor: gridColor,
              tickcolor: axisColor,
              tickfont: { color: axisColor },
              titlefont: { color: axisColor },
              showline: true,
              linecolor: axisColor,
              type: "linear",
              range: [0, 10000],  // X-axis range: 0 to 20kHz
              autorange: false,
            },
            yaxis: {
              title: frequencyScale === FFT_SCALES.LOG
                ? "Hearing Level (dB HL)"
                : "Magnitude",
              color: themeColor,
              gridcolor: gridColor,
              tickcolor: axisColor,
              tickfont: { color: axisColor },
              titlefont: { color: axisColor },
              showline: true,
              linecolor: axisColor,
              ...(frequencyScale === FFT_SCALES.LOG
                ? { range: [100,-10], autorange: false }
                : { autorange: true }),
            },
            margin: { t: 40, l: 60, r: 20, b: 50 },
            showlegend: false,
            autosize: true
          }}
          style={{ width: "100%", height: "100%" }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
          }}
        />
      )}

    </div>
  );
}