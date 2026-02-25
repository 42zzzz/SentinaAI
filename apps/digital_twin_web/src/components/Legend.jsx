import React from 'react';

// Notice we accept the currentLayer prop here!
function Legend({ currentLayer = 'occupancy' }) {
  
  // We define all three possible legends here to match the HallMesh colors exactly
  const legendConfigs = {
    occupancy: {
      title: 'OCCUPANCY LEVELS',
      levels: [
        { color: '#4ade80', label: 'Low (0-25%)' },
        { color: '#fbbf24', label: 'Medium (25-60%)' },
        { color: '#f97316', label: 'High (60-80%)' },
        { color: '#ef4444', label: 'Critical (80%+)' },
      ]
    },
    co2: {
      title: 'CO₂ AIR QUALITY (ppm)',
      levels: [
        { color: '#4ade80', label: 'Good (< 600)' },
        { color: '#fbbf24', label: 'Fair (600 - 800)' },
        { color: '#f97316', label: 'Poor (800 - 1000)' },
        { color: '#9333ea', label: 'Toxic (1000+)' }, // The purple!
      ]
    },
    aiAction: {
      title: 'SENTINAAI DIAGNOSTICS',
      levels: [
        { color: '#1f2937', label: 'Normal / Safe' },
        { color: '#ff0000', label: 'Anomaly Detected' }, // Bright red!
      ]
    }
  };

  // Grab the right configuration based on the dropdown choice
  const config = legendConfigs[currentLayer] || legendConfigs.occupancy;

  return (
    <div className="legend">
      {/* Dynamic Title */}
      <div className="legend-title" style={{ marginBottom: '12px', fontWeight: 'bold' }}>
        {config.title}
      </div>
      
      {/* Dynamic Color Keys */}
      {config.levels.map((level, i) => (
        <div key={i} className="legend-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div
            className="legend-color"
            style={{ background: level.color, width: 32, height: 16, borderRadius: 4, marginRight: '10px' }}
          />
          <span style={{ color: '#ccc', fontSize: '13px' }}>{level.label}</span>
        </div>
      ))}
    </div>
  );
}

export default Legend;