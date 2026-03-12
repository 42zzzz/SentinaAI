import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { DEVICE_TYPE_CONFIG, DEVICE_STATUS_CONFIG } from '../data/devicesLayout';
import { SCALE, DWTC_OUTLINE } from '../data/hallsLayout';

const LERP_SPEED = 0.1;

// Devices sit inside the hall (halls span y=0–10; y=3 is visible through
// the semi-transparent walls when the hall is selected).
const BASE_Y = 3;

function DeviceMarker({ device, isHallSelected, deviceTelemetry }) {
  const [hovered, setHovered] = useState(false);

  const centerX = (DWTC_OUTLINE.minX + DWTC_OUTLINE.maxX) / 2;
  const centerY = (DWTC_OUTLINE.minY + DWTC_OUTLINE.maxY) / 2;

  const worldX = (device.svgX - centerX) * SCALE;
  const worldZ = (device.svgY - centerY) * SCALE;

  const liveStatus = deviceTelemetry?.[device.id]?.status ?? device.status;
  const typeConfig = DEVICE_TYPE_CONFIG[device.type] ?? DEVICE_TYPE_CONFIG.other;
  const statusConfig = DEVICE_STATUS_CONFIG[liveStatus] ?? DEVICE_STATUS_CONFIG.online;

  // Imperative scale animation — refs in JSX props don't re-render, so we
  // mutate the mesh scale directly inside useFrame instead.
  const meshRef = useRef();
  const animScaleRef = useRef(isHallSelected ? 1.5 : 0.5);
  const targetScale = isHallSelected ? 1.5 : 0.5;

  useFrame(() => {
    animScaleRef.current = THREE.MathUtils.lerp(animScaleRef.current, targetScale, LERP_SPEED);
    if (meshRef.current) {
      meshRef.current.scale.setScalar(animScaleRef.current);
    }
  });

  const showTooltip = isHallSelected && hovered;

  return (
    // Hidden entirely when hall is not selected — keeps default view uncluttered.
    <group position={[worldX, BASE_Y, worldZ]} visible={isHallSelected}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshStandardMaterial
          color={typeConfig.color}
          emissive={typeConfig.color}
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>

      {/* Label shown when hall is focused */}
      <Html
        position={[0, 1.0, 0]}
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

      {/* Tooltip on hover */}
      {showTooltip && (
        <Html
          position={[0, 2.2, 0]}
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
