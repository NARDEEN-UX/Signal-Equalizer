import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Title, Tooltip, Legend);

/** One FFT plot: freq vs magnitude; variant "input"|"output" for single-panel cards, or both. */
const FFTChart = ({ data, audiogram, variant }) => {
  if (!data || !Array.isArray(data.freq) || !Array.isArray(data.in) || !Array.isArray(data.out)) {
    return <div className="chart-wrap">No FFT data</div>;
  }

  const freq = data.freq;
  const datasets = [];
  if (!variant || variant === 'input') {
    datasets.push({ label: 'Input', data: data.in, borderColor: '#531009', borderWidth: 2, pointRadius: 0, tension: 0.2 });
  }
  if (!variant || variant === 'output') {
    datasets.push({ label: 'Output', data: data.out, borderColor: '#3e0c07', borderWidth: 2, pointRadius: 0, tension: 0.2 });
  }

  const chartData = {
    labels: freq,
    datasets
  };

  const fontFamily = "'Plus Jakarta Sans', -apple-system, sans-serif";
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: audiogram ? 'logarithmic' : 'linear',
        title: { display: true, text: 'Frequency (Hz)', color: '#737373', font: { family: fontFamily, size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#737373', font: { family: fontFamily, size: 10 } }
      },
      y: {
        min: 0,
        max: 2,
        title: { display: true, text: 'Magnitude', color: '#737373', font: { family: fontFamily, size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#737373', font: { family: fontFamily, size: 10 } }
      }
    },
    plugins: {
      legend: { labels: { color: '#f2f2f2', font: { family: fontFamily, size: 11 } } }
    }
  };

  return (
    <div className="chart-wrap" style={{ height: 300 }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default FFTChart;
