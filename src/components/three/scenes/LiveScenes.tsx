"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { BarnModel, ClassroomModel, HouseModel, SchoolModel } from "../models/Buildings";

export type SceneKind = "gate" | "classroom" | "parking" | "house" | "barn";

const CAMS: Record<SceneKind, { pos: [number, number, number]; fov: number; look: [number, number, number] }> = {
  gate: { pos: [3.5, 3.2, 7.5], fov: 38, look: [0, 1, 0] },
  classroom: { pos: [0, 3.6, 4.6], fov: 50, look: [0, 0.2, 0] },
  parking: { pos: [4, 2.6, 6], fov: 36, look: [0, 1, 0] },
  house: { pos: [-3.5, 2.4, 6], fov: 36, look: [0, 1, 0] },
  barn: { pos: [4.5, 2.8, 6.5], fov: 38, look: [0.6, 1.2, 0] },
};

function Cam({ kind }: { kind: SceneKind }) {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const c = CAMS[kind];
  useFrame(() => ref.current?.lookAt(...c.look));
  return <PerspectiveCamera ref={ref} makeDefault position={c.pos} fov={c.fov} />;
}

/** Grey-scale simulated CCTV frame rendered inside a drei <View> */
export function LiveScene({ kind, paused, night }: { kind: SceneKind; paused?: boolean; night?: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    // subtle camera-shake / sensor drift for realism
    if (!g.current || paused) return;
    const t = s.clock.elapsedTime;
    g.current.position.x = Math.sin(t * 0.7) * 0.008;
    g.current.position.y = Math.cos(t * 0.9) * 0.006;
  });
  return (
    <>
      <Cam kind={kind} />
      <ambientLight intensity={night ? 0.25 : 0.75} />
      <directionalLight position={[-4, 8, 6]} intensity={night ? 0.4 : 1.6} />
      <directionalLight position={[5, 3, -4]} intensity={0.5} />
      {night && <pointLight position={[-0.5, 1.2, 2]} intensity={6} color="#ffe2a8" distance={4} />}
      <group ref={g}>
        {kind === "gate" && <SchoolModel tone="mono" />}
        {kind === "classroom" && <ClassroomModel />}
        {kind === "parking" && <HouseModel tone="mono" />}
        {kind === "house" && <HouseModel tone="mono" night={night} />}
        {kind === "barn" && <BarnModel tone="mono" />}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color={night ? "#1a1d26" : "#6b7181"} roughness={1} />
        </mesh>
      </group>
    </>
  );
}
