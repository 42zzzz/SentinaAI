import React from 'react';
import Scene3D from './components/Scene3D';
import InfoPanel from './components/InfoPanel';
import Controls from './components/Controls';
import Legend from './components/Legend';
import HallDetails from './components/HallDetails';
import HallEditor from './components/HallEditor';
import { HallsProvider } from './context/HallsContext';
import { useTelemetry } from './hooks/useTelemetry';
import './App.css';

function AppContent() {
  const [currentView, setCurrentView] = React.useState('all');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const telemetryData = useTelemetry();

  return (
    <div className="app">
      {!isEditMode && (
        <>
          <Scene3D 
            telemetryData={telemetryData}
            currentView={currentView}
          />
          
          <InfoPanel telemetryData={telemetryData} />
          <Legend />
        </>
      )}

      <Controls 
        currentView={currentView}
        onViewChange={setCurrentView}
        isEditMode={isEditMode}
        onToggleEdit={() => setIsEditMode(!isEditMode)}
      />

      {isEditMode && (
        <HallEditor onClose={() => setIsEditMode(false)} />
      )}
    </div>
  );
}

function App() {
  return (
    <HallsProvider>
      <AppContent />
    </HallsProvider>
  );
}

export default App;
