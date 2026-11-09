"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Grid, Lightformer, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { SecurityCamera } from "../models/SecurityCamera";
import { useDeviceTier, useReducedMotion } from "../hooks";

const damp = THREE.MathUtils.damp;

export type ScrollRef = { current: number };

export function StudioLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <ambientLight intensity={0.25 * intensity} />
      <directionalLight position={[-4, 6, 5]} intensity={1.6 * intensity} color="#dbe7ff" castShadow />
      <directionalLight position={[5, 2, -6]} intensity={2.2 * intensity} color="#3b6bff" />
      <pointLight position={[-3, -1, 2]} intensity={14 * intensity} color="#22d3ee" distance={8} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -2]} scale={[10, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color="#8fb3ff" />
        <Lightformer form="ring" intensity={4} position={[5, 2, 3]} scale={2} color="#4f8cff" />
        <Lightformer form="rect" intensity={1} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} color="#0b1230" />
      </Environment>
    </>
  );
}

function Rig({ progress }: { progress: ScrollRef }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const { viewport, camera } = useThree();
  const narrow = viewport.width < 7.5;

  useFrame((state, dt) => {
    const p = progress.current;
    const px = reduced ? 0 : state.pointer.x;
    const py = reduced ? 0 : state.pointer.y;
    if (head.current) {
      // The camera "tracks" the visitor's cursor
      head.current.rotation.y = damp(head.current.rotation.y, 0.5 - px * 0.45, 3.5, dt);
      head.current.rotation.z = damp(head.current.rotation.z, -0.34 + py * 0.22, 3.5, dt);
    }
    if (root.current) {
      // narrow screens (phones, tablets): inside the screen, right of the short "KO'PROQ KO'RING" lines,
      // below the top menu — a fixed x of 1.5 put it on the screen edge and y 1.9 under the menu
      const phone = viewport.width < 3.6;
      const baseX = narrow ? viewport.width * (phone ? 0.22 : 0.26) : 3.1;
      root.current.position.x = damp(root.current.position.x, baseX - p * (narrow ? 0.3 : 1.6), 4, dt);
      root.current.position.y = damp(root.current.position.y, (narrow ? viewport.height * (phone ? 0.1 : 0.16) : -0.35) + p * 1.2, 4, dt);
      root.current.rotation.y = damp(root.current.rotation.y, -0.35 + p * 1.4 + (reduced ? 0 : px * 0.08), 4, dt);
      const s = narrow ? (phone ? 0.3 : 0.42) : 0.78;
      root.current.scale.setScalar(damp(root.current.scale.x, s * (1 + p * 0.25), 4, dt));
    }
    camera.position.z = damp(camera.position.z, 10 - p * 2.2, 3, dt);
    camera.position.y = damp(camera.position.y, 0.4 + py * 0.15 - p * 0.6, 3, dt);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={root}>
      <Float speed={reduced ? 0 : 1.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <SecurityCamera headRef={head} />
      </Float>
    </group>
  );
}

export default function HeroScene({ progress }: { progress: ScrollRef }) {
  const tier = useDeviceTier();
  return (
    <>
      <color attach="background" args={["#060a15"]} />
      <fog attach="fog" args={["#060a15", 10, 26]} />
      <StudioLights />
      <Rig progress={progress} />
      <Grid
        position={[0, -2.4, 0]}
        args={[40, 40]}
        cellSize={0.6}
        cellThickness={0.5}
        cellColor="#13224a"
        sectionSize={3}
        sectionThickness={0.8}
        sectionColor="#1f3d8f"
        fadeDistance={24}
        fadeStrength={1.4}
        infiniteGrid
      />
      <ContactShadows position={[2.5, -2.39, 0]} opacity={0.45} scale={10} blur={2.8} far={5} color="#000" />
      <Sparkles count={tier === "low" ? 30 : 80} scale={[16, 7, 8]} size={1.6} speed={0.25} color="#8fb3ff" opacity={0.6} />
      {tier !== "low" && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.9} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette darkness={0.55} offset={0.25} />
        </EffectComposer>
      )}
    </>
  );
}
