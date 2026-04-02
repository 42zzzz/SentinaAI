import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

const BLADE_W = 0.15;
const BLADE_L = 1.2;
const BLADE_H = 0.05;
const HUB_R = 0.2;

export default function HVACIndicator({ position, co2Level }) {
  const groupRef = useRef();

  // Rotation speed: 800ppm → slow, 2000ppm → fast
  const speed = 0.01 + ((co2Level - 800) / 1200) * 0.08;

  const bladeGeo = useMemo(() => new THREE.BoxGeometry(BLADE_W, BLADE_H, BLADE_L), []);
  const hubGeo = useMemo(() => new THREE.CylinderGeometry(HUB_R, HUB_R, 0.15, 12), []);

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += speed;
  });

  return (
    <group position={position}>
      {/* Spinning blades */}
      <group ref={groupRef}>
        {[0, 1, 2].map(i => (
          <mesh
            key={i}
            geometry={bladeGeo}
            rotation={[0, (i * Math.PI * 2) / 3, 0]}
            position={[
              Math.sin((i * Math.PI * 2) / 3) * (BLADE_L / 2),
              0,
              Math.cos((i * Math.PI * 2) / 3) * (BLADE_L / 2),
            ]}
          >
            <meshStandardMaterial
              color="#94a3b8"
              metalness={0.7}
              roughness={0.3}
              emissive="#3b82f6"
              emissiveIntensity={0.3}
            />
          </mesh>
        ))}
        {/* Hub */}
        <mesh geometry={hubGeo}>
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* HVAC badge */}
      <Html position={[0, -1.2, 0]} center zIndexRange={[50, 0]} pointerEvents="none">
        <div style={{
          background: 'rgba(59, 130, 246, 0.85)',
          color: '#fff',
          fontSize: '8px',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4,
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
          HVAC
        </div>
      </Html>
    </group>
  );
}
