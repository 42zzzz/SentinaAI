import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import DeviceMarker from './DeviceMarker';
import HallCountBadge from './HallCountBadge';
import { HALLS_LAYOUT } from '../data/hallsLayout';

// Build a quick lookup: hallId → zone, so we can filter by currentView
const HALL_ZONE_MAP = {};
HALLS_LAYOUT.forEach(h => { HALL_ZONE_MAP[h.id] = (h.zone || '').toLowerCase(); });

// Camera distance beyond which individual icons collapse to count badges
const LOD_THRESHOLD = 60;

function DeviceLayer({ devices, selectedHallId, currentView, deviceTelemetry }) {
  const [isZoomedOut, setIsZoomedOut] = useState(false);
  const prevZoomedOut = useRef(false);

  useFrame(({ camera }) => {
    const d = camera.position.length();
    const zoomedOut = d > LOD_THRESHOLD;
    if (zoomedOut !== prevZoomedOut.current) {
      prevZoomedOut.current = zoomedOut;
      setIsZoomedOut(zoomedOut);
    }
  });

  // Group devices by hallId, respecting zone filter
  const hallGroups = {};
  for (const device of devices) {
    const hallZone = HALL_ZONE_MAP[device.hallId] || '';
    if (currentView !== 'all' && !hallZone.includes(currentView.toLowerCase())) continue;
    if (!hallGroups[device.hallId]) hallGroups[device.hallId] = [];
    hallGroups[device.hallId].push(device);
  }

  return (
    <group name="device-layer">
      {Object.entries(hallGroups).map(([hallId, group]) => {
        // Selected hall always shows individual icons regardless of zoom
        const showIndividual = !isZoomedOut || selectedHallId === hallId;

        if (showIndividual) {
          return group.map(device => (
            <DeviceMarker
              key={device.id}
              device={device}
              isHallSelected={selectedHallId === device.hallId}
              deviceTelemetry={deviceTelemetry}
            />
          ));
        }

        return (
          <HallCountBadge
            key={hallId}
            hallId={hallId}
            count={group.length}
          />
        );
      })}
    </group>
  );
}

export default DeviceLayer;
