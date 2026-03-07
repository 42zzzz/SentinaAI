import React, { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { DEVICE_TYPE_CONFIG, DEVICE_STATUS_CONFIG } from '../data/devicesLayout';
import { SCALE, HALL_HEIGHT, DWTC_OUTLINE } from '../data/hallsLayout';

const LERP_SPEED = 0.1;

// Cylinder geometry per device type (cached)
const GEOMETRY_CACHE = {};
function getGeometry(type) {
  if (!GEOMETRY_CACHE[type]) {
    const g = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8);
    GEOMETRY_CACHE[type] = g;
  }
  return GEOMETRY_CACHE[type];
}

function DeviceMarker({ device, isHallSelected, deviceTelemetry }) {
  const [hovered, setHovered] = useState(false);

  const centerX = (DWTC_OUTLINE.minX + DWTC_OUTLINE.maxX) / 2;
  const centerY = (DWTC_OUTLINE.minY + DWTC_OUTLINE.maxY) / 2;

  const worldX = (device.svgX - centerX) * SCALE;
  const worldZ = (device.svgY - centerY) * SCALE;
  // Float above the hall surface; devices sit just above the top of the hall block
  const baseY = HALL_HEIGHT + 0.8;

  // Resolve current device status from live telemetry or fall back to static
  const liveStatus = deviceTelemetry?.[device.id]?.status ?? device.status;
  const typeConfig = DEVICE_TYPE_CONFIG[device.type] ?? DEVICE_TYPE_CONFIG.other;
  const statusConfig = DEVICE_STATUS_CONFIG[liveStatus] ?? DEVICE_STATUS_CONFIG.online;

  // Target scale: large + labelled when hall is selected, tiny when not
  const targetScale = isHallSelected ? 1.5 : 0.5;
  const scaleRef = useRef(targetScale);

  useFrame(() => {
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, LERP_SPEED);
  });

  const geometry = useMemo(() => getGeometry(device.type), [device.type]);

  const showTooltip = isHallSelected && hovered;
  const showLabel = isHallSelected;

  return (
    <group position={[worldX, baseY, worldZ]}>
      <mesh
        geometry={geometry}
        scale={[scaleRef.current, scaleRef.current, scaleRef.current]}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <meshStandardMaterial
          color={typeConfig.color}
          emissive={typeConfig.color}
          emissiveIntensity={isHallSelected ? 0.6 : 0.1}
          roughness={0.4}
          metalness={0.5}
          transparent
          opacity={isHallSelected ? 1.0 : 0.45}
        />
      </mesh>

      {/* Status dot — small sphere on top of the cylinder */}
      {isHallSelected && (
        <mesh position={[0, 0.65, 0]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial
            color={statusConfig.color}
            emissive={statusConfig.color}
            emissiveIntensity={0.8}
          />
        </mesh>
      )}

      {/* Label shown when hall is focused */}
      {showLabel && (
        <Html
          position={[0, 1.4, 0]}
          center
          zIndexRange={[200, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(10, 10, 20, 0.88)',
            color: '#f1f5f9',
            padding: '3px 7px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            border: `1px solid ${typeConfig.color}44`,
            boxShadow: `0 0 6px ${typeConfig.color}55`,
            letterSpacing: '0.02em',
          }}>
            {device.label}
          </div>
        </Html>
      )}

      {/* Tooltip on hover */}
      {showTooltip && (
        <Html
          position={[0, 2.6, 0]}
          center
          zIndexRange={[300, 0]}
        >
          <div style={{
            background: 'rgba(10, 10, 25, 0.96)',
            color: '#e2e8f0',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            minWidth: '140px',
            border: `1px solid ${typeConfig.color}66`,
            boxShadow: `0 4px 16px rgba(0,0,0,0.6), 0 0 8px ${typeConfig.color}44`,
            pointerEvents: 'none',
          }}>
            <div style={{ color: typeConfig.color, fontWeight: '700', marginBottom: '4px' }}>
              {typeConfig.label}
            </div>
            <div style={{ marginBottom: '2px' }}>{device.label}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '3px' }}>
              ID: {device.id}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: '3px',
              background: `${statusConfig.color}22`,
              color: statusConfig.color,
              fontSize: '10px',
              fontWeight: '600',
            }}>
              {liveStatus.toUpperCase()}
            </div>
            {deviceTelemetry?.[device.id]?.value !== undefined && (
              <div style={{ marginTop: '4px', color: '#cbd5e1', fontSize: '10px' }}>
                {deviceTelemetry[device.id].value} {deviceTelemetry[device.id].unit ?? ''}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export default DeviceMarker;
