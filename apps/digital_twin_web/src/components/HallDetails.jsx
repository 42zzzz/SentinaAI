import React from 'react';

function HallDetails({ hall, telemetryData, onClose }) {
  if (!hall) return null;

  const data = telemetryData[hall.telemetryId] || {};

  return (
    <div className="hall-details">
      <button className="close-btn" onClick={onClose}>×</button>
      <h1>{hall.telemetryId}</h1>
      
      <div className="stat">
        <span className="stat-label">Zone</span>
        <span className="stat-value">{hall.zone}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Occupancy</span>
        <span className="stat-value">{data.occupancy || 0}%</span>
      </div>
      <div className="stat">
        <span className="stat-label">Temperature</span>
        <span className="stat-value">{data.temperature || 22}°C</span>
      </div>
      <div className="stat">
        <span className="stat-label">Humidity</span>
        <span className="stat-value">{data.humidity || 50}%</span>
      </div>
      <div className="stat">
        <span className="stat-label">CO₂</span>
        <span className="stat-value">{data.co2 || 400} ppm</span>
      </div>
      <div className="stat">
        <span className="stat-label">Noise Level</span>
        <span className="stat-value">{data.noise || 40} dB</span>
      </div>
    </div>
  );
}

export default HallDetails;
