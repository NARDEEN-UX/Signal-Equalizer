import React from 'react';

/** Bar chart of wavelet level energies; variant "input"|"output" shows one series per card. */
const WaveletChart = ({ data, variant }) => {
  if (!data?.levels?.length) return <div className="chart-wrap">No wavelet data</div>;

  const maxIn = Math.max(...(data.in || [1]), 1e-8);
  const maxOut = Math.max(...(data.out || [1]), 1e-8);
  const showInput = !variant || variant === 'input';
  const showOutput = !variant || variant === 'output';
  const scaleMax = showInput && !showOutput ? maxIn : (showOutput && !showInput ? maxIn : Math.max(maxIn, maxOut, 1e-8));

  return (
    <div className="wavelet-bars">
      {data.levels.map((level, i) => (
        <div key={i} className="wavelet-bar-wrap">
          {showInput && <div className="wavelet-bar in" style={{ height: `${(data.in?.[i] ?? 0) / scaleMax * 80}px` }} />}
          {showOutput && <div className="wavelet-bar out" style={{ height: `${(data.out?.[i] ?? 0) / scaleMax * 80}px` }} />}
          <span>L{i}</span>
        </div>
      ))}
    </div>
  );
};

export default WaveletChart;
