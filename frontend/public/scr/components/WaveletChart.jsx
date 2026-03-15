import React from 'react';

const WaveletChart = ({ data }) => {
  if (!data?.levels?.length) return <div>No wavelet data</div>;

  const maxIn = Math.max(...(data.in || [1]), 1e-8);
  const maxOut = Math.max(...(data.out || [1]), 1e-8);

  return (
    <div className="wavelet-bars">
      {data.levels.map((level, i) => (
        <div key={i} className="wavelet-bar-wrap">
          <div
            className="wavelet-bar in"
            style={{ height: `${(data.in?.[i] ?? 0) / maxIn * 80}px` }}
          />
          <div
            className="wavelet-bar out"
            style={{ height: `${(data.out?.[i] ?? 0) / maxOut * 80}px` }}
          />
          <span>L{i}</span>
        </div>
      ))}
    </div>
  );
};

export default WaveletChart;
