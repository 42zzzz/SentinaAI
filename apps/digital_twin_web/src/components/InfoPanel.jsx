import React from 'react';

function InfoPanel({ telemetryData }) {
  const stats = calculateStats(telemetryData);

  return (
    <div className="info-panel">
      <h1>SentinaAI Digital Twin</h1>
      <div className="subtitle">Dubai World Trade Centre</div>
      
      <h2>Building</h2>
      <div className="stat">
        <span className="stat-label">Total Zones</span>
        <span className="stat-value">4</span>
      </div>
      <div className="stat">
        <span className="stat-label">Total Halls</span>
        <span className="stat-value">26</span>
      </div>
      <div className="stat">
        <span className="stat-label">IoT Devices</span>
        <span className="stat-value">154</span>
      </div>

      <h2>Live Status</h2>
      <div className="stat">
        <span className="stat-label">
          <span className="status-indicator status-active"></span>
          Active Devices
        </span>
        <span className="stat-value">{stats.activeDevices}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Avg Occupancy</span>
        <span className="stat-value">{stats.avgOccupancy}%</span>
      </div>
      <div className="stat">
        <span className="stat-label">Avg Temperature</span>
        <span className="stat-value">{stats.avgTemp}°C</span>
      </div>
      <div className="stat">
        <span className="stat-label">Avg CO₂</span>
        <span className="stat-value">{stats.avgCO2} ppm</span>
      </div>
    </div>
  );
}

function calculateStats(data) {
  const values = Object.values(data);
  if (values.length === 0) {
    return { activeDevices: 0, avgOccupancy: 0, avgTemp: 0, avgCO2: 0 };
  }

  const sum = values.reduce((acc, val) => ({
    occupancy: acc.occupancy + (val.occupancy || 0),
    temperature: acc.temperature + (val.temperature || 0),
    co2: acc.co2 + (val.co2 || 0),
  }), { occupancy: 0, temperature: 0, co2: 0 });

  return {
    activeDevices: values.length,
    avgOccupancy: Math.round(sum.occupancy / values.length),
    avgTemp: (sum.temperature / values.length).toFixed(1),
    avgCO2: Math.round(sum.co2 / values.length),
  };
}

export default InfoPanel;
