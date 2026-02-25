import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import HallMesh from './HallMesh';
import { useHalls } from '../context/HallsContext';
import { SCALE, HALL_HEIGHT, DWTC_OUTLINE } from '../data/hallsLayout';

function FrameLimiter() {
  const { invalidate } = useThree();
  
  useEffect(() => {
    const interval = setInterval(() => {
      invalidate();
    }, 1000 / 24);
    
    return () => clearInterval(interval);
  }, [invalidate]);
  
  return null;
}

// 🔥 Scene3D with Floating Block Labels
function Scene3D({ telemetryData, currentView, currentLayer }) {
  const { halls, selectedHallId, setSelectedHallId } = useHalls();
  const centerX = (DWTC_OUTLINE.minX + DWTC_OUTLINE.maxX) / 2;
  const centerY = (DWTC_OUTLINE.minY + DWTC_OUTLINE.maxY) / 2;

  return (
    <Canvas
      shadows
      frameloop="demand"
      gl={{ preserveDrawingBuffer: true }}
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

      {halls.map((hall) => {
        // Calculate the physical position for the label
        const x = hall.x - centerX;
        const z = hall.z - centerY;

        return (
          <group key={hall.id}>
            <HallMesh
              hall={hall}
              centerX={centerX}
              centerY={centerY}
              onClick={() => setSelectedHallId(hall.id)}
              telemetryData={telemetryData}
              currentView={currentView}
              isSelected={selectedHallId === hall.id}
              currentLayer={currentLayer}
            />
            
            {/* 🔥 THE HALL NAME ON THE BLOCK 🔥 */}
            <Text
              position={[x, HALL_HEIGHT + 1, z]} 
              rotation={[-Math.PI / 2, 0, 0]} 
              fontSize={2.5} 
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              outlineWidth={0.2}
              outlineColor="#000000"
              depthTest={false} // Forces it to draw ON TOP of the block
              renderOrder={999}
            >
              {hall.label || hall.id.replace('hall', ' HALL ').toUpperCase()}
            </Text>
          </group>
        );
      })}

      <gridHelper args={[200, 50, 0x1a1a1a, 0x111111]} position={[0, 0, 0]} />
    </Canvas>
  );
}

export default Scene3D;