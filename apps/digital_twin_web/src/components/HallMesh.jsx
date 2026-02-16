import React, { useState } from 'react';
import { SCALE, HALL_HEIGHT } from '../data/hallsLayout';

function HallMesh({ hall, centerX, centerY, onClick, telemetryData, currentView }) {
  const [hovered, setHovered] = useState(false);

  const x = (hall.x - centerX) * SCALE;
  const z = (hall.y - centerY) * SCALE;
  const width = hall.width * SCALE;
  const depth = hall.height * SCALE;

  const data = telemetryData[hall.telemetryId] || {};
  const occupancy = data.occupancy || 0;
  const color = getOccupancyColor(occupancy / 100);

  if (currentView !== 'all' && !hall.zone.toLowerCase().includes(currentView)) {
    return null;
  }

  return (
    <group 
      position={[x, HALL_HEIGHT / 2, z]} 
      rotation={[0, (hall.rotation || 0) * Math.PI / 180, 0]}
    >
      <mesh
        castShadow
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => onClick(hall)}
        scale={hovered ? [1.03, 1.05, 1.03] : [1, 1, 1]}
      >
        <boxGeometry args={[width, HALL_HEIGHT, depth]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2 + (occupancy / 100) * 0.3}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}

function getOccupancyColor(rate) {
  if (rate < 0.25) return '#4ade80';
  if (rate < 0.60) return '#fbbf24';
  if (rate < 0.80) return '#f97316';
  return '#ef4444';
}

export default HallMesh;
