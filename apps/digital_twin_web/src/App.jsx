import React, { useState } from 'react';
import Scene3D from './components/Scene3D';
import InfoPanel from './components/InfoPanel';
import Controls from './components/Controls';
import Legend from './components/Legend';
import HallDetails from './components/HallDetails';
import HallEditor from './components/HallEditor';
import { useTelemetry } from './hooks/useTelemetry';
import { HALLS_LAYOUT } from './data/hallsLayout';
import './App.css';

function App() {
  // SINGLE SOURCE OF TRUTH: halls state lives here
  const [halls, setHalls] = useState([...HALLS_LAYOUT]);
  
  // Use selectedHallId instead of full object
  const [selectedHallId, setSelectedHallId] = useState(null);
  const [currentView, setCurrentView] = useState('all');
  const [isEditMode, setIsEditMode] = useState(false);
  
  const telemetryData = useTelemetry();

  // Derive selectedHall from halls array
  const selectedHall = halls.find(h => h.id === selectedHallId);

  const handleSaveLayout = (halls) => {
    console.log('Layout saved:', halls);
  };

  const handleExitEditor = () => {
    setIsEditMode(false);
    setSelectedHallId(null); // Clear selection when exiting editor
  };

  return (
    <div className="app">
      {!isEditMode && (
        <>
          <Scene3D 
            halls={halls}
            selectedHallId={selectedHallId}
            onHallClick={(hall) => setSelectedHallId(hall.id)}
            telemetryData={telemetryData}
            currentView={currentView}
          />
          
          <InfoPanel telemetryData={telemetryData} />
          
          <Legend />
          
          {selectedHall && (
            <HallDetails 
              hall={selectedHall}
              telemetryData={telemetryData}
              onClose={() => setSelectedHallId(null)}
            />
          )}
        </>
      )}

      <Controls 
        currentView={currentView}
        onViewChange={setCurrentView}
        isEditMode={isEditMode}
        onToggleEdit={() => setIsEditMode(!isEditMode)}
      />

      <HallEditor
        isEditMode={isEditMode}
        halls={halls}
        setHalls={setHalls}
        selectedHallId={selectedHallId}
        setSelectedHallId={setSelectedHallId}
        onSave={handleSaveLayout}
        onClose={handleExitEditor}
      />
    </div>
  );
}

export default App;
