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

const FFTChart = ({ data, audiogram }) => {
  if (!data) return <div className="chart-wrap">No FFT data</div>;

  const chartData = {
    labels: data.freq,
    datasets: [
      { label: 'Input', data: data.in, borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0 },
      { label: 'Output', data: data.out, borderColor: '#d946ef', borderWidth: 1.5, pointRadius: 0 }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: audiogram ? 'logarithmic' : 'linear',
        title: { display: true, text: 'Frequency (Hz)', color: '#9a9aa8' },
        grid: { color: '#2a2a32' },
        ticks: { color: '#9a9aa8' }
      },
      y: {
        title: { display: true, text: 'Magnitude', color: '#9a9aa8' },
        grid: { color: '#2a2a32' },
        ticks: { color: '#9a9aa8' }
      }
    },
    plugins: {
      legend: { labels: { color: '#e8e8ec' } }
    }
  };

  return (
    <div className="chart-wrap" style={{ height: 220 }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default FFTChart;