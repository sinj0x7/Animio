import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

type ParticlesProps = {
  count?: number;
};

/** Deterministic PRNG so particle layout is stable across re-renders (no Math.random in render). */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const Particles = ({ count: countProp = 3000 }: ParticlesProps) => {
  const points = useRef<THREE.Points>(null);

  const count = countProp;

  const [positions, scales] = useMemo(() => {
    const rand = mulberry32(0x9e3779b9 ^ count);
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (rand() - 0.5) * 50;
      p[i * 3 + 1] = (rand() - 0.5) * 50;
      p[i * 3 + 2] = (rand() - 0.5) * 50;
      s[i] = rand();
    }
    return [p, s];
  }, [count]);

  useFrame((state) => {
    if (points.current) {
      // Very gentle rotation of the entire particle system
      points.current.rotation.y = state.clock.elapsedTime * 0.015;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.005) * 0.05;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-scale"
          count={count}
          array={scales}
          itemSize={1}
          args={[scales, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#ffb7c5"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
