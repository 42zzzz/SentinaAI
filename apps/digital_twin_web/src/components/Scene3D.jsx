import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import HallMesh from './HallMesh';
import { SCALE, HALL_HEIGHT, DWTC_OUTLINE } from '../data/hallsLayout';

// Component to force 24 FPS refresh
function FrameLimiter() {
  const { invalidate } = useThree();
  
  useEffect(() => {
    const interval = setInterval(() => {
      invalidate();
    }, 1000 / 24); // 24 FPS
    
    return () => clearInterval(interval);
  }, [invalidate]);
  
  return null;
}

function Scene3D({ halls, selectedHallId, onHallClick, telemetryData, currentView }) {
  const centerX = (DWTC_OUTLINE.minX + DWTC_OUTLINE.maxX) / 2;
  const centerY = (DWTC_OUTLINE.minY + DWTC_OUTLINE.maxY) / 2;

  return (
    <Canvas
      shadows
      frameloop="demand"
      style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}
    >
      <FrameLimiter />
      
      <PerspectiveCamera makeDefault position={[30, 40, 30]} fov={60} />
      <OrbitControls 
        enableDamping
        dampingFactor={0.05}
        minDistance={15}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2}
      />
      
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[50, 80, 50]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-30, 40, -30]} intensity={0.3} />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
      </mesh>

      {halls.map((hall) => (
        <HallMesh
          key={hall.id}
          hall={hall}
          centerX={centerX}
          centerY={centerY}
          onClick={() => onHallClick(hall)}
          telemetryData={telemetryData}
          currentView={currentView}
          isSelected={selectedHallId === hall.id}
        />
      ))}

      <gridHelper args={[200, 50, 0x1a1a1a, 0x111111]} position={[0, 0, 0]} />
    </Canvas>
  );
}

export default Scene3D;
