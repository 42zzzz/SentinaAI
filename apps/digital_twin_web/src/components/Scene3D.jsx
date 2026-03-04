import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import HallMesh from './HallMesh';
import { useHalls } from '../context/HallsContext';
import { DWTC_OUTLINE } from '../data/hallsLayout';

function FrameLimiter() {
  const { invalidate } = useThree();
  useEffect(() => {
    const interval = setInterval(() => { invalidate(); }, 1000 / 24);
    return () => clearInterval(interval);
  }, [invalidate]);
  return null;
}

// 🔥 UNIVERSAL TRANSLATOR: Makes "NorthHall1", "north_hall_1", and "northhall1" match perfectly
export const normalizeId = (id) => {
  if (!id) return '';
  return String(id).replace(/[_ ]/g, '').toLowerCase();
};

function Scene3D({ telemetryData, currentView, currentLayer }) {
  const { halls, selectedHallId, setSelectedHallId } = useHalls();
  const centerX = (DWTC_OUTLINE.minX + DWTC_OUTLINE.maxX) / 2;
  const centerY = (DWTC_OUTLINE.minY + DWTC_OUTLINE.maxY) / 2;

  // Normalize the selected ID from the Controls simulator
  const normalizedSelectedId = normalizeId(selectedHallId);

  return (
    <Canvas
      shadows
      frameloop="demand"
      gl={{ preserveDrawingBuffer: true }}
      style={{ width: '100vw', height: '100vh', background: '#f8fafc' }}
    >
      <FrameLimiter />
      
      <PerspectiveCamera makeDefault position={[30, 40, 30]} fov={60} />
      <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 80, 50]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-30, 40, -30]} intensity={0.3} />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {halls.map((hall) => {
        // Normalize the 3D map's ID to check against the simulator
        const isCurrentlySelected = 
          normalizedSelectedId === normalizeId(hall.id) || 
          normalizedSelectedId === normalizeId(hall.telemetryId);

        return (
          <HallMesh
            key={hall.id}
            hall={hall}
            centerX={centerX}
            centerY={centerY}
            onClick={() => setSelectedHallId(hall.id)}
            telemetryData={telemetryData}
            currentView={currentView}
            isSelected={isCurrentlySelected} // 🔥 Now it will perfectly highlight!
            currentLayer={currentLayer}
          />
        );
      })}

      <gridHelper args={[200, 50, 0xcbd5e1, 0xe2e8f0]} position={[0, 0, 0]} />
    </Canvas>
  );
}

export default Scene3D;