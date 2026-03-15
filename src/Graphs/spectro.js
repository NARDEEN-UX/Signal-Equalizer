import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import "../CSS_files/spectro.css";

const darkColor = "#1e1e1e";
const purpleColor = "#b73acd";

export default function Spectrogram({ 
  title, 
  audioFile, 
  type = "input", 
  themeColor = purpleColor,
  outputData = null,
  onOutputDataUpdate = null
}) {
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle input spectrogram
  useEffect(() => {
    if (audioFile && type === "input") {
      computeSpectrogram();
    }
  }, [audioFile, type]);

  // Handle output spectrogram
  useEffect(() => {
    if (type === "output") {
      if (outputData) {
        // Direct output data from backend
        setSpectrogramData({
          time: outputData.time || [],
          frequency: outputData.freqs || [],
          magnitude: outputData.magnitude || [],
          duration: outputData.duration,
          sample_rate: outputData.sample_rate
        });
        setError(null);
        console.log("Output spectrogram data set from backend");
      } else {
        // Clear data when outputData is null (new upload)
        setSpectrogramData(null);
        setError(null);
      }
    }
  }, [outputData, type]);

  const computeSpectrogram = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Starting spectrogram computation...");
      
      // Fetch spectrogram data
      const response = await fetch("http://localhost:5000/spectrogram", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();
      console.log("Spectrogram received data:", jsonData);
      
      // Check for error
      if (jsonData.error) {
        console.error("Error in data:", jsonData.error);
        setError(jsonData.error);
        setIsLoading(false);
        return;
      }
      
      // If we have time-frequency data, create a spectrogram
      if (jsonData.time && jsonData.freqs && jsonData.magnitude) {

        setSpectrogramData({
          time: jsonData.time,
          frequency: jsonData.freqs,
          magnitude: jsonData.magnitude,  // 2D: time x frequency
          duration: jsonData.duration,
          sample_rate: jsonData.sample_rate
        });
        console.log("Spectrogram data set successfully");
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Spectrogram error:", err);
      setError(`Failed to compute spectrogram: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="spectrogram-container">
      <h2 className="spectrogram-title">{title}</h2>

      {isLoading && (
        <div className="spectrogram-loading">
          <p>Computing Spectrogram...</p>
        </div>
      )}

      {error && (
        <div className="spectrogram-error">
          <p>❌ Error: {error}</p>
        </div>
      )}

      {spectrogramData && (
        <>
          {console.log("Rendering Plot with data:", {
            x: spectrogramData.time.length,
            y: spectrogramData.frequency.length,
            z: spectrogramData.magnitude.length,
            z0: spectrogramData.magnitude[0]?.length
          })}
          <Plot
            data={[
              {
                type: "heatmap",
                x: spectrogramData.time,
                y: spectrogramData.frequency,
                z: spectrogramData.magnitude.map((_, i) => 
                  spectrogramData.magnitude.map(row => row[i])
                ),
                colorscale: "Jet",
                colorbar: {
                  title: "Magnitude"
                },
                hoverongaps: false,
                reversescale: false
              }
            ]}
            layout={{
              title: "Spectrogram (Time-Frequency)",
              plot_bgcolor: darkColor,
              paper_bgcolor: darkColor,
              font: { color: themeColor },
              xaxis: {
                title: "Time (seconds)",
                color: themeColor
              },
              yaxis: {
                title: "Frequency (Hz)",
                color: themeColor
              },
              margin: { t: 40, l: 60, r: 80, b: 50 },
              height: 300
            }}
            style={{ width: "100%", height: "100%" }}
            config={{
              responsive: true,
              displayModeBar: true
            }}
          />
        </>
      )}
    </div>
  );
}