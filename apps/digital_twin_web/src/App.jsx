import React, { useState } from 'react';
import Scene3D from './components/Scene3D';
import InfoPanel from './components/InfoPanel';
import Controls from './components/Controls';
import Legend from './components/Legend';
import HallDetails from './components/HallDetails';
import HallEditor from './components/HallEditor';
import { HallsProvider, useHalls } from './context/HallsContext';
import { ThemeProvider } from './context/ThemeContext';
import { useTelemetry } from './hooks/useTelemetry';
import { useDeviceTelemetry } from './hooks/useDeviceTelemetry';
import { DEVICES_LAYOUT } from './data/devicesLayout.jsx';
import { HALLS_LAYOUT } from './data/hallsLayout';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('all');
  const [currentLayer, setCurrentLayer] = useState('occupancy');
  const [isEditMode, setIsEditMode] = useState(false);

  // The 3 Modes: 'live', 'history', 'sandbox'
  const [simMode, setSimMode] = useState('live');
  const [timeIndex, setTimeIndex] = useState(12); // Default history to noon (surge)

  // Pulling the new data engine
  const { telemetryData, injectData, activeAnomalies } = useTelemetry(simMode, timeIndex);

  // IoT device telemetry (live status per device)
  const { deviceTelemetry } = useDeviceTelemetry(simMode === 'live');

  return (
    <div className="app">
      {/* GLOBAL ANOMALY ALERT BANNER */}
      {activeAnomalies && activeAnomalies.length > 0 && (
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(220, 38, 38, 0.95)', color: 'white', padding: '15px 30px',
          borderRadius: '8px', zIndex: 9999, border: '2px solid #fca5a5',
          boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)', textAlign: 'center', fontWeight: 'bold'
        }}>
          ⚠️ SENTINAAI ALERT: {activeAnomalies.length} Anomaly Detected!
          <br/>
          <span style={{fontSize: '12px', fontWeight: 'normal'}}>
            AI Action: {activeAnomalies[0].aiAction.toUpperCase()}
          </span>
        </div>
      )}

      {!isEditMode && (
        <>
          <Scene3D
            telemetryData={telemetryData}
            currentView={currentView}
            currentLayer={currentLayer}
            devices={DEVICES_LAYOUT}
            deviceTelemetry={deviceTelemetry}
          />
          <InfoPanel telemetryData={telemetryData} totalHalls={HALLS_LAYOUT.length} totalDevices={DEVICES_LAYOUT.length} />
          <HallDetailsWrapper telemetryData={telemetryData} />
          <Legend currentLayer={currentLayer} />
        </>
      )}

      {isEditMode && <HallEditor onClose={() => setIsEditMode(false)} />}

      <Controls
        currentView={currentView} onViewChange={setCurrentView}
        currentLayer={currentLayer} onLayerChange={setCurrentLayer}
        isEditMode={isEditMode} onToggleEdit={() => setIsEditMode(!isEditMode)}

        // Pass the new mode states to the Controls!
        simMode={simMode} setSimMode={setSimMode}
        timeIndex={timeIndex} setTimeIndex={setTimeIndex}
        injectData={injectData}
      />
    </div>
  );
}

function HallDetailsWrapper({ telemetryData }) {
  const { halls, selectedHallId, setSelectedHallId } = useHalls();
  const selectedHall = halls.find(h => h.id === selectedHallId);
  if (!selectedHall) return null;
  return <HallDetails hall={selectedHall} telemetryData={telemetryData} onClose={() => setSelectedHallId(null)} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <HallsProvider>
        <AppContent />
      </HallsProvider>
    </ThemeProvider>
  );
}
