import React from 'react';

function Legend() {
  const levels = [
    { color: '#4ade80', label: 'Low (0-25%)' },
    { color: '#fbbf24', label: 'Medium (25-60%)' },
    { color: '#f97316', label: 'High (60-80%)' },
    { color: '#ef4444', label: 'Critical (80%+)' },
  ];

  return (
    <div className="legend">
      <div className="legend-title">OCCUPANCY LEVELS</div>
      {levels.map((level, i) => (
        <div key={i} className="legend-item">
          <div
            className="legend-color"
            style={{ background: level.color, width: 32, height: 16, borderRadius: 4 }}
          />
          <span>{level.label}</span>
        </div>
      ))}
    </div>
  );
}

export default Legend;
