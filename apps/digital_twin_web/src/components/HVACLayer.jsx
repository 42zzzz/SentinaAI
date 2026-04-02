import React from 'react';
import HVACIndicator from './HVACIndicator';
import { useHalls } from '../context/HallsContext';
import { HALL_HEIGHT, getHallWorldPosition } from '../data/hallsLayout';
import { isHVACActive } from '../utils/hvacEnergy';

// Re-uses the smart matching logic from HallMesh
function findTelemetry(hall, telemetryData) {
  if (!telemetryData) return {};
  if (telemetryData[hall.id]) return telemetryData[hall.id];
  if (telemetryData[hall.telemetryId]) return telemetryData[hall.telemetryId];
  return {};
}

export function getActiveHVACCount(halls, telemetryData) {
  if (!halls || !telemetryData) return 0;
  return halls.filter(h => {
    const d = findTelemetry(h, telemetryData);
    return isHVACActive(d.co2 || 400);
  }).length;
}

export default function HVACLayer({ telemetryData }) {
  const { halls } = useHalls();

  return (
    <group>
      {halls.map(hall => {
        const data = findTelemetry(hall, telemetryData);
        const co2 = data.co2 || 400;
        if (!isHVACActive(co2)) return null;

        const wp = getHallWorldPosition(hall);
        return (
          <HVACIndicator
            key={hall.id}
            position={[wp.x, HALL_HEIGHT + 2, wp.z]}
            co2Level={co2}
          />
        );
      })}
    </group>
  );
}
