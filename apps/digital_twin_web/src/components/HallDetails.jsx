import React from 'react';

export default function HallDetails({ hall, telemetryData, onClose }) {
  if (!hall) return null;
  const data = telemetryData[hall.id] || telemetryData[hall.telemetryId] || {};
  const occupancyPercent = data.occupancyRatio ? Math.round(data.occupancyRatio * 100) : (data.occupancy || 0);

  return (
    <div className="hall-details">
      <button className="close-btn" onClick={onClose}>×</button>
      <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>{hall.id}</h2>
      
      <div className="stat"><span className="stat-label">Occupancy</span><span className="stat-value">{occupancyPercent}%</span></div>
      <div className="stat"><span className="stat-label">CO₂ Level</span><span className="stat-value">{data.co2 || 400} ppm</span></div>
      <div className="stat"><span className="stat-label">Ambient Temp</span><span className="stat-value">{data.temperature || 22.5}°C</span></div>
      
      <div style={{ 
        marginTop: '20px', padding: '12px', borderRadius: '6px', 
        border: `1px solid ${data.isAnomaly ? '#ef4444' : '#4ade80'}`,
        background: data.isAnomaly ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.05)'
      }}>
        <h4 style={{ margin: 0, color: data.isAnomaly ? '#ef4444' : '#4ade80', fontSize: '11px', textTransform: 'uppercase' }}>
          {data.isAnomaly ? '⚠️ Anomaly Detected' : '✅ System Normal'}
        </h4>
        <p style={{ margin: '8px 0 0 0', fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>
          {data.aiAction ? data.aiAction.toUpperCase().replace(/([A-Z])/g, ' $1') : 'MONITORING'}
        </p>
      </div>
    </div>
  );
}