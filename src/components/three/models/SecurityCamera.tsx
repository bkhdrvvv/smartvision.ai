"use client";

import { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/**
 * Procedural bullet security camera (no external asset needed).
 * The `head` group can be aimed by parents; lens faces local -X.
 */
export const SecurityCamera = forwardRef<THREE.Group, { headRef?: React.RefObject<THREE.Group | null>; ring?: string; beam?: boolean }>(
  function SecurityCamera({ headRef, ring = "#34e7ff", beam = true }, ref) {
    const ringMat = useRef<THREE.MeshStandardMaterial>(null);
    const beamMat = useRef<THREE.MeshBasicMaterial>(null);

    const mats = useMemo(
      () => ({
        shell: new THREE.MeshPhysicalMaterial({ color: "#e9eef8", roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15 }),
        navy: new THREE.MeshPhysicalMaterial({ color: "#14254f", roughness: 0.35, metalness: 0.7, clearcoat: 0.6 }),
        dark: new THREE.MeshPhysicalMaterial({ color: "#05070d", roughness: 0.08, metalness: 0.9, clearcoat: 1 }),
        arm: new THREE.MeshStandardMaterial({ color: "#2f4f9e", roughness: 0.3, metalness: 0.8 }),
      }),
      [],
    );

    useFrame(({ clock }) => {
      const t = clock.elapsedTime;
      if (ringMat.current) ringMat.current.emissiveIntensity = 2.4 + Math.sin(t * 2.2) * 0.8;
      if (beamMat.current) beamMat.current.opacity = 0.05 + (Math.sin(t * 1.3) + 1) * 0.015;
    });

    return (
      <group ref={ref}>
        {/* wall mount */}
        <RoundedBox args={[0.9, 0.18, 0.6]} radius={0.06} position={[0.55, 2.25, 0]} material={mats.navy} />
        <mesh position={[0.25, 1.55, 0]} rotation={[0, 0, -0.18]} material={mats.arm}>
          <cylinderGeometry args={[0.075, 0.09, 1.45, 24]} />
        </mesh>
        <mesh position={[0.12, 0.82, 0]} material={mats.navy}>
          <sphereGeometry args={[0.17, 32, 32]} />
        </mesh>

        {/* head */}
        <group ref={headRef} position={[0.1, 0.55, 0]}>
          <RoundedBox args={[2.75, 0.07, 1.0]} radius={0.03} position={[-0.1, 0.5, 0]} material={mats.shell} />
          <mesh position={[0, 0.42, 0]} material={mats.navy}>
            <boxGeometry args={[0.35, 0.12, 0.3]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.shell}>
            <cylinderGeometry args={[0.43, 0.43, 2.1, 48]} />
          </mesh>
          <mesh position={[1.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.navy}>
            <cylinderGeometry args={[0.4, 0.43, 0.12, 48]} />
          </mesh>
          <mesh position={[-1.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.navy}>
            <cylinderGeometry args={[0.47, 0.45, 0.2, 48]} />
          </mesh>
          <mesh position={[-1.22, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.dark}>
            <cylinderGeometry args={[0.36, 0.36, 0.04, 48]} />
          </mesh>
          <mesh position={[-1.235, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.37, 0.028, 16, 96]} />
            <meshStandardMaterial ref={ringMat} color={ring} emissive={ring} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
          <mesh position={[-1.2, 0, 0]}>
            <sphereGeometry args={[0.16, 32, 32]} />
            <meshPhysicalMaterial color="#0a1a3d" emissive="#1e5bff" emissiveIntensity={0.45} roughness={0} metalness={1} clearcoat={1} />
          </mesh>
          {beam && (
            <mesh position={[-1.24 - 2.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[1.8, 5.2, 48, 1, true]} />
              <meshBasicMaterial ref={beamMat} color="#3b82f6" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          )}
        </group>
      </group>
    );
  },
);
