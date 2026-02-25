import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { SCALE, HALL_HEIGHT, isPolygonHall } from '../data/hallsLayout';

// 🔥 NEW: Added currentLayer to the props
function HallMesh({ hall, centerX, centerY, onClick, telemetryData, currentView, isSelected, currentLayer = 'occupancy' }) {
  const [hovered, setHovered] = useState(false);

  // Safely grab the AI data for this specific hall
  const data = telemetryData[hall.id] || telemetryData[hall.telemetryId] || {};
  
  // 🔥 NEW: Dynamic Color & Glow Logic based on the Dropdown!
  let blockColor = '#4ade80'; // Default Green
  let glowIntensity = 0.2;

  if (currentLayer === 'occupancy') {
    // 1. OCCUPANCY LAYER (Green -> Red)
    const rate = data.occupancyRatio || (data.occupancy || 0) / 100;
    if (rate < 0.25) blockColor = '#4ade80'; // Low
    else if (rate < 0.60) blockColor = '#fbbf24'; // Medium
    else if (rate < 0.80) blockColor = '#f97316'; // High
    else blockColor = '#ef4444'; // Critical
    glowIntensity = 0.2 + (rate * 0.3);

  } else if (currentLayer === 'co2') {
    // 2. CO2 AIR QUALITY LAYER (Green -> Purple)
    const co2 = data.co2 || 400;
    if (co2 < 600) blockColor = '#4ade80'; // Good
    else if (co2 < 800) blockColor = '#fbbf24'; // Fair
    else if (co2 < 1000) blockColor = '#f97316'; // Poor
    else blockColor = '#9333ea'; // Toxic (Purple!)
    glowIntensity = 0.2 + ((co2 - 400) / 1000 * 0.5);

  } else if (currentLayer === 'aiAction') {
    // 3. SENTINAAI DIAGNOSTICS LAYER (Dark -> Bright Red)
    if (data.isAnomaly) {
      blockColor = '#ff0000'; // Pure bright red for anomalies
      glowIntensity = 0.8; // High glow to grab attention
    } else {
      blockColor = '#1f2937'; // Dark gray (dormant/safe)
      glowIntensity = 0.05;
    }
  }

  // Override color if the user clicks on it
  if (isSelected) {
    blockColor = '#3b82f6'; // Bright blue when selected
    glowIntensity = 0.6;
  }

  // --- Spatial Geometry (Unchanged) ---
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
      return new THREE.ExtrudeGeometry(shape, { depth: HALL_HEIGHT, bevelEnabled: false });
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

  if (currentView !== 'all' && (!hall.zone || !hall.zone.toLowerCase().includes(currentView))) {
    return null;
  }

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
          color={blockColor}
          emissive={blockColor}
          emissiveIntensity={glowIntensity}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}

export default HallMesh;