import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Stars,
  Sparkles,
  Float,
  AdaptiveDpr,
} from '@react-three/drei';
import { EffectComposer, Bloom, Noise, DepthOfField, Vignette } from '@react-three/postprocessing';
import { Particles } from './Particles';
import { LittlestTokyo } from './LittlestTokyo';
import { CameraController } from './CameraController';

function AnimePostFX({ isMobile, isLowPower }: { isMobile: boolean; isLowPower: boolean }) {
  const bloomNoiseVignette = (
    <>
      <Bloom
        luminanceThreshold={0.25}
        luminanceSmoothing={0.92}
        intensity={isMobile ? 0.55 : 0.72}
        radius={0.65}
      />
      <Noise opacity={isMobile ? 0.012 : 0.018} />
      <Vignette eskil={false} offset={0.12} darkness={isMobile ? 0.55 : 0.65} />
    </>
  );

  if (isLowPower) {
    return <EffectComposer multisampling={0}>{bloomNoiseVignette}</EffectComposer>;
  }

  return (
    <EffectComposer multisampling={0}>
      <DepthOfField
        focusDistance={0.012}
        focalLength={0.04}
        bokehScale={isMobile ? 2 : 3.5}
        height={isMobile ? 360 : 480}
      />
      {bloomNoiseVignette}
    </EffectComposer>
  );
}

function Scene() {
  const { size } = useThree();
  const isMobile = size.width < 768;
  const isLowPower = size.width < 1024;

  const starCount = isMobile ? 1200 : 3000;
  const sparkleCount = isMobile ? 80 : 200;

  const fogArgs = useMemo(
    () => ['#0B0C10', 14, 58] as [string, number, number],
    []
  );

  return (
    <>
      <color attach="background" args={['#0B0C10']} />
      <fog attach="fog" args={fogArgs} />

      <AdaptiveDpr />

      {/* Softer, more cinematic fill */}
      <hemisphereLight intensity={0.45} color="#ffd6e8" groundColor="#1a2030" />
      <ambientLight intensity={0.35} color="#f0e8ff" />
      <directionalLight
        position={[12, 14, 8]}
        intensity={1.35}
        color="#ffc4d6"
        castShadow
      />
      <directionalLight
        position={[-12, -8, -6]}
        intensity={0.85}
        color="#9fd4ff"
      />

      <Stars
        radius={55}
        depth={55}
        count={starCount}
        factor={4}
        saturation={0.85}
        fade
        speed={0.35}
      />
      <Sparkles
        count={sparkleCount}
        scale={14}
        size={isMobile ? 1.4 : 2}
        speed={0.35}
        color="#ffd27a"
      />

      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.45} position={[2, -4, -5]}>
        <LittlestTokyo scale={0.025} />
      </Float>

      <Particles count={isMobile ? 1400 : 3000} />

      <CameraController />

      <ContactShadows
        position={[0, -6, 0]}
        opacity={0.28}
        scale={34}
        blur={isMobile ? 2 : 3}
        far={16}
      />

      <AnimePostFX isMobile={isMobile} isLowPower={isLowPower} />
    </>
  );
}

export { Scene };
export default Scene;
