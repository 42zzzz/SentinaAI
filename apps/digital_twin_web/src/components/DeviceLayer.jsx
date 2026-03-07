import React from 'react';
import DeviceMarker from './DeviceMarker';
import { HALLS_LAYOUT } from '../data/hallsLayout';

// Build a quick lookup: hallId → zone, so we can filter by currentView
const HALL_ZONE_MAP = {};
HALLS_LAYOUT.forEach(h => { HALL_ZONE_MAP[h.id] = (h.zone || '').toLowerCase(); });

function DeviceLayer({ devices, selectedHallId, currentView, deviceTelemetry }) {
  return (
    <group name="device-layer">
      {devices.map(device => {
        // Respect zone view filter (same logic as HallMesh:113)
        const hallZone = HALL_ZONE_MAP[device.hallId] || '';
        if (currentView !== 'all' && !hallZone.includes(currentView.toLowerCase())) {
          return null;
        }

        return (
          <DeviceMarker
            key={device.id}
            device={device}
            isHallSelected={selectedHallId === device.hallId}
            deviceTelemetry={deviceTelemetry}
          />
        );
      })}
    </group>
  );
}

export default DeviceLayer;
