"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { BarnModel, HouseModel, SchoolModel, ServerModel } from "../models/Buildings";
import { SecurityCamera } from "../models/SecurityCamera";
import { StudioLights } from "./HeroScene";
import { useDeviceTier, useReducedMotion } from "../hooks";

export type ViewerModel = "school" | "home" | "farm" | "camera" | "server";
export const ANGLES: Record<string, [number, number, number]> = {
  front: [0, 1.2, 9],
  side: [9, 1.5, 0.5],
  top: [0.5, 9.5, 2],
  iso: [6, 4, 6.5],
};

function CameraTo({ angle, controls }: { angle: keyof typeof ANGLES; controls: React.RefObject<OrbitImpl | null> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...ANGLES[angle]!));
  const moving = useRef(true);
  useEffect(() => {
    target.current.set(...ANGLES[angle]!);
    moving.current = true;
  }, [angle]);
  useFrame((_, dt) => {
    if (!moving.current) return;
    camera.position.lerp(target.current, 1 - Math.exp(-4 * dt));
    controls.current?.update();
    if (camera.position.distanceTo(target.current) < 0.02) moving.current = false;
  });
  return null;
}

export default function ViewerScene({ model, angle, autoRotate }: { model: ViewerModel; angle: keyof typeof ANGLES; autoRotate: boolean }) {
  const controls = useRef<OrbitImpl>(null);
  const tier = useDeviceTier();
  const reduced = useReducedMotion();
  return (
    <>
      <color attach="background" args={["#070c1b"]} />
      <StudioLights />
      <hemisphereLight args={["#6b8cff", "#05070d", 0.5]} />
      <group position={[0, model === "camera" ? -0.4 : -1.3, 0]}>
        {model === "school" && <SchoolModel />}
        {model === "home" && <HouseModel />}
        {model === "farm" && <BarnModel />}
        {model === "server" && <group position={[0, 1.3, 0]}><ServerModel /></group>}
        {model === "camera" && <SecurityCamera beam={false} />}
      </group>
      <ContactShadows position={[0, -1.31, 0]} opacity={0.6} scale={12} blur={2.6} far={4} />
      <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={Math.PI / 2.05} autoRotate={autoRotate && !reduced} autoRotateSpeed={0.8} enableDamping />
      <CameraTo angle={angle} controls={controls} />
      {tier !== "low" && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.6} luminanceThreshold={0.95} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}
