import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Outlines } from '@react-three/drei';
import * as THREE from 'three';

export const FloatingShapes = () => {
  const group = useRef<THREE.Group>(null);
  const mesh1 = useRef<THREE.Mesh>(null);
  const mesh2 = useRef<THREE.Mesh>(null);
  const mesh3 = useRef<THREE.Mesh>(null);

  // Create a 3-step anime cel-shading gradient map
  const gradientMap = useMemo(() => {
    const format = THREE.RedFormat;
    const colors = new Uint8Array([80, 170, 255]); // 3 steps of brightness
    const map = new THREE.DataTexture(colors, colors.length, 1, format);
    map.needsUpdate = true;
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    return map;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (mesh1.current) {
      mesh1.current.rotation.x = t * 0.05;
      mesh1.current.rotation.y = t * 0.08;
    }
    if (mesh2.current) {
      mesh2.current.rotation.x = t * 0.03;
      mesh2.current.rotation.y = -t * 0.06;
    }
    if (mesh3.current) {
      mesh3.current.rotation.z = t * 0.04;
      mesh3.current.rotation.x = t * 0.02;
    }
  });

  return (
    <group ref={group}>
      {/* Shape 1 (Sakura Pink) */}
      <Float speed={1} rotationIntensity={0.5} floatIntensity={1} position={[2, 0, -2]}>
        <mesh ref={mesh1}>
          <torusKnotGeometry args={[1.5, 0.4, 64, 16]} />
          <meshToonMaterial
            color="#ff6b8b"
            gradientMap={gradientMap}
          />
          <Outlines thickness={0.03} color="#4a0010" />
        </mesh>
      </Float>

      {/* Shape 2 (Golden Hour) */}
      <Float speed={0.8} rotationIntensity={0.3} floatIntensity={0.8} position={[-4, -3, -6]}>
        <mesh ref={mesh2}>
          <icosahedronGeometry args={[2.5, 0]} />
          <meshToonMaterial
            color="#ffd700"
            gradientMap={gradientMap}
          />
          <Outlines thickness={0.04} color="#5a4000" />
        </mesh>
      </Float>
      
      {/* Shape 3 (Anime Sky Blue) */}
      <Float speed={1.2} rotationIntensity={0.8} floatIntensity={1.2} position={[5, -6, -10]}>
        <mesh ref={mesh3}>
          <octahedronGeometry args={[3, 0]} />
          <meshToonMaterial
            color="#4facfe"
            gradientMap={gradientMap}
          />
          <Outlines thickness={0.04} color="#002244" />
        </mesh>
      </Float>
    </group>
  );
};
