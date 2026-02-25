import React, { useState } from 'react';

const ALL_HALLS = [
  { id: 'northhall1', label: 'North Hall 1' }, { id: 'northhall2', label: 'North Hall 2' },
  { id: 'northhall3', label: 'North Hall 3' }, { id: 'northhall4', label: 'North Hall 4' },
  { id: 'northhall5', label: 'North Hall 5' }, { id: 'northhall6', label: 'North Hall 6' },
  { id: 'easthall1', label: 'East Hall 1' }, { id: 'easthall2', label: 'East Hall 2' },
  { id: 'easthall3', label: 'East Hall 3' }, { id: 'easthall4', label: 'East Hall 4' },
  { id: 'southhall1', label: 'South Hall 1' }, { id: 'southhall2', label: 'South Hall 2' },
  { id: 'southhall3', label: 'South Hall 3' }, { id: 'southhall4', label: 'South Hall 4' },
  { id: 'southhall5', label: 'South Hall 5' }, { id: 'southhall6', label: 'South Hall 6' },
  { id: 'hall1', label: 'Central Hall 1' }, { id: 'hall2', label: 'Central Hall 2' },
  { id: 'hall3', label: 'Central Hall 3' }, { id: 'hall4', label: 'Central Hall 4' },
  { id: 'hall5', label: 'Central Hall 5' }, { id: 'hall6', label: 'Central Hall 6' },
  { id: 'hall7', label: 'Central Hall 7' }, { id: 'hall8', label: 'Central Hall 8' },
  { id: 'hall9', label: 'Central Hall 9' }, { id: 'hall10', label: 'Central Hall 10' }
];

function Controls({ 
  currentView, onViewChange, isEditMode, onToggleEdit,
  currentLayer, onLayerChange, simMode, setSimMode,
  timeIndex, setTimeIndex, injectData
}) {
  const views = [
    { id: 'all', label: 'View All 🚀' }, 
    { id: 'north', label: 'North' },
    { id: 'east', label: 'East' },
    { id: 'south', label: 'South' },
    { id: 'central', label: 'Central' },
  ];

  const [injectHall, setInjectHall] = useState('hall1');
  const [injectOcc, setInjectOcc] = useState(95);
  const [injectCO2, setInjectCO2] = useState(800);

  const handleExportSnapshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `SentinaAI-Snapshot-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="controls-wrapper" style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '12px',
      background: 'rgba(15, 15, 15, 0.98)', padding: '20px', borderRadius: '12px',
      border: '1px solid #333', backdropFilter: 'blur(15px)', width: 'fit-content'
    }}>
      
      {/* Top Row: Navigation + Modes */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {views.map((v) => (
          <button key={v.id} className={currentView === v.id && !isEditMode ? 'active' : ''}
            onClick={() => onViewChange(v.id)} style={{ padding: '8px 12px', fontSize: '11px' }}>
            {v.label}
          </button>
        ))}
        <div style={{ width: '1px', height: '20px', background: '#444', margin: '0 8px' }} />
        <button onClick={() => setSimMode('live')} style={{ background: simMode === 'live' ? '#10b981' : '#222', color: '#fff', border: '1px solid #444', padding: '8px 14px', fontSize: '11px', fontWeight: 'bold' }}>🟢 Live IoT</button>
        <button onClick={() => setSimMode('history')} style={{ background: simMode === 'history' ? '#9333ea' : '#222', color: '#fff', border: '1px solid #444', padding: '8px 14px', fontSize: '11px', fontWeight: 'bold' }}>🕒 History</button>
        <button onClick={() => setSimMode('sandbox')} style={{ background: simMode === 'sandbox' ? '#ef4444' : '#222', color: '#fff', border: '1px solid #444', padding: '8px 14px', fontSize: '11px', fontWeight: 'bold' }}>🧪 Sandbox</button>
        <div style={{ width: '1px', height: '20px', background: '#444', margin: '0 8px' }} />
        <button className={isEditMode ? 'active btn-edit' : 'btn-edit'} onClick={onToggleEdit} style={{ padding: '8px 14px', fontSize: '11px' }}>{isEditMode ? 'Exit Editor' : 'Edit Layout'}</button>
      </div>

      {/* 🕒 HISTORY SCRUBBER UI */}
      {simMode === 'history' && (
        <div style={{ borderTop: '1px solid #9333ea', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9333ea', fontSize: '10px', fontWeight: 'bold' }}>
            <span>HISTORY LOG (24H)</span><span>TIMESTAMP: {timeIndex}:00:00</span>
          </div>
          <input type="range" min="0" max="24" value={timeIndex} onChange={(e) => setTimeIndex(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#9333ea', cursor: 'pointer' }} />
        </div>
      )}

      {/* 🧪 THE INJECTION PANEL */}
      {simMode === 'sandbox' && (
        <div style={{ borderTop: '1px solid #ef4444', paddingTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginRight: '10px' }}>DATA INJECTOR:</span>
          <select value={injectHall} onChange={(e) => setInjectHall(e.target.value)} style={{ background: '#000', color: '#fff', padding: '6px', border: '1px solid #444', borderRadius: '4px', fontSize: '11px' }}>
            {ALL_HALLS.map((hall) => <option key={hall.id} value={hall.id}>{hall.label}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#888', fontSize: '10px' }}>Occ %:</label>
            <input type="number" value={injectOcc} onChange={(e) => setInjectOcc(e.target.value)} style={{ width: '50px', background: '#000', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#888', fontSize: '10px' }}>CO₂:</label>
            <input type="number" value={injectCO2} onChange={(e) => setInjectCO2(e.target.value)} style={{ width: '60px', background: '#000', color: '#fff', border: '1px solid #444', padding: '4px', fontSize: '11px' }} />
          </div>
          <button onClick={() => injectData(injectHall, injectOcc, injectCO2)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>
            ⚡ Inject Ripple
          </button>
        </div>
      )}

      {/* Bottom Row: Layers & Export */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid #333', paddingTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: '#888', fontSize: '10px', fontWeight: 'bold' }}>DATA LAYER:</label>
          <select value={currentLayer} onChange={(e) => onLayerChange(e.target.value)}
            style={{ background: '#000', color: '#fff', padding: '6px', borderRadius: '4px', border: '1px solid #444', fontSize: '11px' }}>
            <option value="occupancy">Occupancy (%)</option>
            <option value="co2">CO₂ Levels (ppm)</option>
            <option value="aiAction">AI Recommendations</option>
          </select>
        </div>

        <button onClick={handleExportSnapshot} style={{ background: '#2E86C1', color: 'white', border: 'none', padding: '8px 16px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>
          📸 Export Snapshot
        </button>
      </div>
    </div>
  );
}

export default Controls;