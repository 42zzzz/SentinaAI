import React from 'react';

function Legend({ currentLayer = 'occupancy' }) {
  const legendConfigs = {
    occupancy: {
      title: 'OCCUPANCY LEVELS',
      levels: [
        { color: '#4ade80', label: 'Low',      range: '0 – 25%' },
        { color: '#fbbf24', label: 'Medium',   range: '25 – 60%' },
        { color: '#f97316', label: 'High',     range: '60 – 80%' },
        { color: '#ef4444', label: 'Critical', range: '80%+' },
      ]
    },
    co2: {
      title: 'CO₂ AIR QUALITY (ppm)',
      levels: [
        { color: '#4ade80', label: 'Good',  range: '< 600' },
        { color: '#fbbf24', label: 'Fair',  range: '600 – 800' },
        { color: '#f97316', label: 'Poor',  range: '800 – 1000' },
        { color: '#9333ea', label: 'Toxic', range: '1000+' },
      ]
    },
    aiAction: {
      title: 'SENTINAAI DIAGNOSTICS',
      levels: [
        { color: '#1f2937', label: 'Safe',    range: 'Normal' },
        { color: '#ff0000', label: 'Anomaly', range: 'Detected' },
      ]
    },
    sustainability: {
      title: 'CARBON FOOTPRINT',
      levels: [
        { color: '#22c55e', label: 'Efficient', range: '< 500 ppm' },
        { color: '#94a3b8', label: 'Moderate',  range: '500 – 700' },
        { color: '#475569', label: 'High',      range: '700 – 900' },
        { color: '#0f172a', label: 'Critical',  range: '900+' },
      ]
    }
  };

  const config = legendConfigs[currentLayer] || legendConfigs.occupancy;

  return (
    <div className="legend">
      <div className="legend-title" style={{ marginBottom: '12px', fontWeight: 'bold' }}>
        {config.title}
      </div>
      {config.levels.map((level, i) => (
        <div key={i} className="legend-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          {/* Color swatch with short text tag for colorblind accessibility */}
          <div
            className="legend-color"
            style={{
              background: level.color,
              width: 42,
              height: 18,
              borderRadius: 4,
              marginRight: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '8px', fontWeight: '800', color: '#fff', letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.7)', userSelect: 'none' }}>
              {level.label.toUpperCase()}
            </span>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{level.range}</span>
        </div>
      ))}
    </div>
  );
}

export default Legend;
