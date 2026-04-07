import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export const CameraController = () => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, -1, 14);
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.08) * 1.5;
    camera.position.y = -1 + Math.cos(t * 0.06) * 0.5;
    camera.rotation.y = Math.sin(t * 0.05) * 0.06;
    camera.rotation.x = Math.cos(t * 0.04) * 0.03;
  });

  return null;
};
