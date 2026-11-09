"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Float, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import { BarnModel, HouseModel, SchoolModel, ServerModel } from "../models/Buildings";
import { SecurityCamera } from "../models/SecurityCamera";
import { StudioLights } from "./HeroScene";
import { useReducedMotion } from "../hooks";

const damp = THREE.MathUtils.damp;

/* ───────── Solution card scene (school / home / farm) ───────── */
export function SolutionScene({ kind, hovered }: { kind: "school" | "home" | "farm"; hovered: boolean }) {
  const g = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  useFrame((state, dt) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime;
    const target = hovered ? state.pointer.x * 0.6 : reduced ? -0.4 : -0.4 + Math.sin(t * 0.3) * 0.15;
    g.current.rotation.y = damp(g.current.rotation.y, target, 3, dt);
    const s = hovered ? 1.06 : 1;
    g.current.scale.setScalar(damp(g.current.scale.x, s, 4, dt));
  });
  return (
    <>
      <StudioLights intensity={0.9} />
      <hemisphereLight args={["#6b8cff", "#05070d", 0.6]} />
      <group ref={g} position={[0, -1.2, 0]}>
        <Float speed={reduced ? 0 : 1.4} rotationIntensity={0.05} floatIntensity={0.25}>
          {kind === "school" && <SchoolModel />}
          {kind === "home" && <HouseModel />}
          {kind === "farm" && <BarnModel />}
        </Float>
      </group>
      <ContactShadows position={[0, -1.22, 0]} opacity={0.6} scale={8} blur={2.4} far={3} />
    </>
  );
}

// Note: postprocessing is only used on opaque canvases (hero, viewer); these cards are
// transparent so their CSS gradients show through.

/* ───────── Ecosystem core (drag to rotate) ───────── */
export function EcosystemScene({ active }: { active: number | null }) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const dots = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const [grab, setGrab] = useState(false);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (dots.current && !reduced) dots.current.rotation.y = t * 0.25;
    const glow = active !== null ? 1 : 0.35;
    for (const r of [ring1.current, ring2.current]) {
      if (!r) continue;
      const m = r.material as THREE.MeshBasicMaterial;
      m.opacity = damp(m.opacity, glow * (r === ring1.current ? 0.5 : 0.3), 4, dt);
    }
  });

  return (
    <>
      <StudioLights intensity={1.1} />
      <PresentationControls global={false} cursor snap rotation={[0.35, -0.5, 0]} polar={[-0.2, 0.4]} azimuth={[-1.2, 1.2]}>
        <group onPointerDown={() => setGrab(true)} onPointerUp={() => setGrab(false)} scale={grab ? 1.02 : 1}>
          <Float speed={reduced ? 0 : 1.2} rotationIntensity={0.05} floatIntensity={0.3}>
            <ServerModel />
          </Float>
        </group>
      </PresentationControls>
      <group rotation={[0.12, 0, 0]}>
        <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.9, 0.006, 8, 160]} />
          <meshBasicMaterial color="#4f8cff" transparent opacity={0.2} />
        </mesh>
        <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.6, 0.005, 8, 200]} />
          <meshBasicMaterial color="#7c5cff" transparent opacity={0.12} />
        </mesh>
        <group ref={dots}>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            const r = i % 2 ? 4.6 : 2.9;
            return (
              <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <sphereGeometry args={[0.045, 12, 12]} />
                <meshBasicMaterial color="#cfe0ff" toneMapped={false} />
              </mesh>
            );
          })}
        </group>
      </group>
      <ContactShadows position={[0, -1.1, 0]} opacity={0.7} scale={9} blur={3} far={3} color="#000" />
    </>
  );
}

/* ───────── CTA camera ───────── */
export function CtaScene() {
  const g = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, 0.5 - state.pointer.x * 0.4 + (reduced ? 0 : Math.sin(t * 0.6) * 0.15), 3, dt);
      head.current.rotation.z = damp(head.current.rotation.z, -0.25 + state.pointer.y * 0.15, 3, dt);
    }
  });
  return (
    <>
      <StudioLights />
      <group ref={g} position={[0.6, -0.2, 0]} scale={0.95}>
        <SecurityCamera headRef={head} beam={false} ring="#ffffff" />
      </group>
    </>
  );
}
