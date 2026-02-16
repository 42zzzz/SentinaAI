import { useState, useEffect } from 'react';

// Custom hook for telemetry data
export function useTelemetry() {
  const [data, setData] = useState({});

  useEffect(() => {
    // Generate demo data
    const interval = setInterval(() => {
      const newData = {};
      
      // Generate data for all halls
      const halls = ['HZA01', 'HZA02', 'HZA03', 'HZA04', 'HZA05', 'HZA06',
                     'HZB01', 'HZB02', 'HZB03', 'HZB04', 'HZB05', 'HZB06', 'HZB07', 'HZB08',
                     'HZC01', 'HZC02', 'HZC03', 'HZC04', 'HZC05', 'HZC06',
                     'HZD01', 'HZD02', 'HZD03', 'HZD04', 'HZD05', 'HZD06'];

      halls.forEach(hallId => {
        const baseOccupancy = 30 + Math.random() * 40;
        newData[hallId] = {
          occupancy: Math.round(baseOccupancy),
          temperature: (21 + Math.random() * 3).toFixed(1),
          humidity: (45 + Math.random() * 15).toFixed(1),
          co2: Math.round(400 + Math.random() * 200),
          noise: (35 + Math.random() * 20).toFixed(1),
        };
      });

      setData(newData);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return data;
}
