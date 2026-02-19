import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { SCALE, HALL_HEIGHT, isPolygonHall } from '../data/hallsLayout';

function HallMesh({ hall, centerX, centerY, onClick, telemetryData, currentView, isSelected }) {
  const [hovered, setHovered] = useState(false);

  const data = telemetryData[hall.telemetryId] || {};
  const occupancy = data.occupancy || 0;
  const color = getOccupancyColor(occupancy / 100);

  if (currentView !== 'all' && !hall.zone.toLowerCase().includes(currentView)) {
    return null;
  }

  const geometry = useMemo(() => {
    if (isPolygonHall(hall)) {
      const shape = new THREE.Shape();
      
      hall.vertices.forEach((vertex, i) => {
        const x = (vertex[0] - centerX) * SCALE;
        const z = (vertex[1] - centerY) * SCALE;
        
        if (i === 0) {
          shape.moveTo(x, z);
        } else {
          shape.lineTo(x, z);
        }
      });
      shape.closePath();

      const extrudeSettings = {
        depth: HALL_HEIGHT,
        bevelEnabled: false
      };

      return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    } else {
      const width = hall.width * SCALE;
      const depth = hall.height * SCALE;
      return new THREE.BoxGeometry(width, HALL_HEIGHT, depth);
    }
  }, [hall, centerX, centerY]);

  const position = useMemo(() => {
    if (isPolygonHall(hall)) {
      return [0, HALL_HEIGHT / 2, 0];
    } else {
      const x = (hall.x + hall.width / 2 - centerX) * SCALE;
      const z = (hall.y + hall.height / 2 - centerY) * SCALE;
      return [x, HALL_HEIGHT / 2, z];
    }
  }, [hall, centerX, centerY]);

  const rotation = useMemo(() => {
    if (isPolygonHall(hall)) {
      return [0, 0, 0];
    } else {
      return [0, (hall.rotation || 0) * Math.PI / 180, 0];
    }
  }, [hall]);

  return (
    <group position={position} rotation={rotation}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onClick}
        scale={hovered ? [1.03, 1.05, 1.03] : [1, 1, 1]}
      >
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
