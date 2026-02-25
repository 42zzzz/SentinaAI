import { useState, useEffect, useMemo } from 'react';

const hallIdMap = {
  'northhall1': 'HZA01', 'northhall2': 'HZA02', 'northhall3': 'HZA03', 
  'northhall4': 'HZA04', 'northhall5': 'HZA05', 'northhall6': 'HZA06',
  'hall1': 'HZB01', 'hall2': 'HZB02', 'hall3': 'HZB03', 'hall4': 'HZB04',
  'hall5': 'HZB05', 'hall6': 'HZB06', 'hall7': 'HZB07', 'hall8': 'HZB08',
  'southhall1': 'HZC01', 'southhall2': 'HZC02', 'southhall3': 'HZC03', 
  'southhall4': 'HZC04', 'southhall5': 'HZC05', 'southhall6': 'HZC06',
  'easthall1': 'HZD01', 'easthall2': 'HZD02', 'easthall3': 'HZD03', 'easthall4': 'HZD04',
  'hall9': 'HZD05', 'hall10': 'HZD06'
};

const generateSimulationHistory = () => {
  const history = [];
  const reactIds = Object.values(hallIdMap);
  for (let hour = 0; hour <= 24; hour++) {
    const hourData = {};
    reactIds.forEach(id => {
      const timeCurve = 1 - Math.abs(hour - 12) / 12; 
      const baseRatio = (timeCurve * 0.8) + (Math.random() * 0.25); 
      const isAnomaly = baseRatio > 0.92;
      hourData[id] = {
        occupancyRatio: Math.min(baseRatio, 1.1),
        co2: Math.round(400 + (baseRatio * 600)),
        aiAction: isAnomaly ? 'dispatchSecurityAndOpenRoutes' : 'monitor',
        isAnomaly: isAnomaly,
        temperature: (21 + (timeCurve * 4)).toFixed(1),
        hallName: Object.keys(hallIdMap).find(key => hallIdMap[key] === id)
      };
    });
    history.push(hourData);
  }
  return history;
};

export function useTelemetry(simMode = 'live', timeIndex = 24) {
  const [liveData, setLiveData] = useState({});
  const [sandboxData, setSandboxData] = useState({}); 
  const [isRetraining, setIsRetraining] = useState(false);

  const historyData = useMemo(() => generateSimulationHistory(), []);

  // 1. LIVE DATA POLLING
  useEffect(() => {
    if (simMode !== 'live') return;
    const fetchAIData = async () => {
      try {
        const response = await fetch('/api/venue-status');
        const result = await response.json();
        if (result.status === "success") {
          const formattedData = {};
          result.data.forEach(hall => {
            const reactId = hallIdMap[hall.id] || hall.id;
            formattedData[reactId] = {
              occupancyRatio: hall.occupancyRatio,
              co2: Math.round(hall.co2),
              aiAction: hall.aiRecommendedAction,
              isAnomaly: hall.isAnomaly,
              temperature: "22.5",
              hallName: hall.id
            };
          });
          setLiveData(formattedData);
          setSandboxData(formattedData); 
        }
      } catch (err) { console.error("FastAPI Offline"); }
    };
    fetchAIData();
    const interval = setInterval(fetchAIData, 5000);
    return () => clearInterval(interval);
  }, [simMode]);

  // 2. DATA INJECTION ENGINE
  const injectData = async (targetHall, occupancy, co2) => {
    try {
      const response = await fetch('/api/simulate-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hall_id: targetHall, occupancy: parseInt(occupancy), co2: parseInt(co2) })
      });
      const result = await response.json();
      if (result.status === "success") {
        setSandboxData(prev => {
          const newState = { ...prev };
          result.updates.forEach(update => {
            const reactId = hallIdMap[update.hall_id] || update.hall_id;
            newState[reactId] = {
              ...newState[reactId],
              occupancyRatio: update.occupancyRatio,
              co2: update.co2,
              aiAction: update.aiAction,
              isAnomaly: update.isAnomaly,
              hallName: update.hall_id
            };
          });
          return newState;
        });
      }
    } catch (err) { console.error("Injection failed"); }
  };

  // 3. AUTOMATIC RETRAINING TRIGGER (No Button Required)
  let currentData = liveData;
  if (simMode === 'history') currentData = historyData[timeIndex];
  if (simMode === 'sandbox') currentData = sandboxData;

  const activeAnomalies = Object.values(currentData || {}).filter(hall => hall.isAnomaly);

  useEffect(() => {
    if (activeAnomalies.length > 0 && !isRetraining) {
      setIsRetraining(true);
      console.log("Anomaly Detected: Step 7/8 Continuous Learning Auto-Triggered...");
      
      fetch('/api/retrain', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            console.log("Model Updated Automatically.");
            setTimeout(() => setIsRetraining(false), 5000); // Cooldown to avoid spam
          }
        })
        .catch(err => setIsRetraining(false));
    }
  }, [activeAnomalies.length]);

  return { telemetryData: currentData, injectData, activeAnomalies, isRetraining };
}