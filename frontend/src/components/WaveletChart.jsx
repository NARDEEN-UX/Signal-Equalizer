import React from 'react';

/** Bar chart of wavelet level energies; variant "input"|"output" shows one series. */
const WaveletChart = ({ data, variant }) => {
  if (!data?.levels?.length) return <div className="chart-wrap">No wavelet data</div>;

  const values = variant === 'output' ? (data.out || []) : (data.in || []);
  const maxVal = Math.max(...values, 1e-8);

  return (
    <div className="wavelet-bars">
      {data.levels.map((level, i) => (
        <div key={i} className="wavelet-bar-wrap">
          <div
            className={`wavelet-bar ${variant === 'output' ? 'out' : 'in'}`}
            style={{ height: `${(values[i] ?? 0) / maxVal * 80}px` }}
          />
          <span>L{i}</span>
        </div>
      ))}
    </div>
  );
};

export default WaveletChart;
