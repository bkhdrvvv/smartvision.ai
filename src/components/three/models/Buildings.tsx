"use client";

import { useMemo } from "react";
import * as THREE from "three";

type Tone = "color" | "mono";

function useMats(tone: Tone) {
  return useMemo(() => {
    if (tone === "mono") {
      return {
        wall: new THREE.MeshStandardMaterial({ color: "#c9ced8", roughness: 0.85 }),
        wall2: new THREE.MeshStandardMaterial({ color: "#aeb4c0", roughness: 0.85 }),
        roof: new THREE.MeshStandardMaterial({ color: "#3b4254", roughness: 0.6 }),
        win: new THREE.MeshStandardMaterial({ color: "#5a6478", roughness: 0.3, metalness: 0.4 }),
        warm: new THREE.MeshStandardMaterial({ color: "#e8dcb8", roughness: 0.5 }),
        door: new THREE.MeshStandardMaterial({ color: "#1d2230", roughness: 0.6 }),
        metal: new THREE.MeshStandardMaterial({ color: "#8a93a6", roughness: 0.4, metalness: 0.6 }),
      };
    }
    return {
      wall: new THREE.MeshStandardMaterial({ color: "#2e3f78", roughness: 0.55, metalness: 0.15 }),
      wall2: new THREE.MeshStandardMaterial({ color: "#253463", roughness: 0.55, metalness: 0.15 }),
      roof: new THREE.MeshStandardMaterial({ color: "#3d63ff", roughness: 0.35, metalness: 0.45 }),
      win: new THREE.MeshStandardMaterial({ color: "#8fd3ff", emissive: "#4fb4ff", emissiveIntensity: 1.6, toneMapped: false }),
      warm: new THREE.MeshStandardMaterial({ color: "#ffd77a", emissive: "#ffc94d", emissiveIntensity: 1.3, toneMapped: false }),
      door: new THREE.MeshStandardMaterial({ color: "#05070d", roughness: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ color: "#0b1020", roughness: 0.25, metalness: 0.85 }),
    };
  }, [tone]);
}

function Windows({ cols, rows, w, h, gapX, gapY, z, mat, y0 = 0 }: { cols: number; rows: number; w: number; h: number; gapX: number; gapY: number; z: number; mat: THREE.Material; y0?: number }) {
  const items = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      items.push(
        <mesh key={`${r}-${c}`} position={[(c - (cols - 1) / 2) * gapX, y0 + r * gapY, z]} material={mat}>
          <boxGeometry args={[w, h, 0.02]} />
        </mesh>,
      );
  return <>{items}</>;
}

/** Gable roof prism along X */
function Gable({ width, depth, height, y, mat }: { width: number; depth: number; height: number; y: number; mat: THREE.Material }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-depth / 2 - 0.08, 0);
    s.lineTo(0, height);
    s.lineTo(depth / 2 + 0.08, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: width + 0.16, bevelEnabled: false });
    g.translate(0, 0, -(width + 0.16) / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [width, depth, height]);
  return <mesh geometry={geo} position={[0, y, 0]} material={mat} castShadow />;
}

export function SchoolModel({ tone = "color" }: { tone?: Tone }) {
  const m = useMats(tone);
  return (
    <group>
      {/* center tower */}
      <mesh position={[0, 1.3, 0]} material={m.wall} castShadow>
        <boxGeometry args={[1.3, 2.6, 1.2]} />
      </mesh>
      <mesh position={[0, 2.66, 0]} material={m.roof}>
        <boxGeometry args={[1.45, 0.12, 1.35]} />
      </mesh>
      <Windows cols={2} rows={4} w={0.38} h={0.28} gapX={0.5} gapY={0.55} z={0.61} mat={m.win} y0={0.55} />
      {/* wings */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.55, 0, -0.1]}>
          <mesh position={[0, 0.95, 0]} material={m.wall2} castShadow>
            <boxGeometry args={[1.8, 1.9, 1.0]} />
          </mesh>
          <mesh position={[0, 1.95, 0]} material={m.roof}>
            <boxGeometry args={[1.9, 0.1, 1.1]} />
          </mesh>
          <Windows cols={3} rows={3} w={0.3} h={0.26} gapX={0.52} gapY={0.55} z={0.51} mat={m.win} y0={0.45} />
        </group>
      ))}
      <mesh position={[0, 0.35, 0.62]} material={m.door}>
        <boxGeometry args={[0.45, 0.7, 0.04]} />
      </mesh>
    </group>
  );
}

export function HouseModel({ tone = "color", night = false }: { tone?: Tone; night?: boolean }) {
  const m = useMats(tone);
  return (
    <group>
      <mesh position={[0, 0.85, 0]} material={m.wall} castShadow>
        <boxGeometry args={[2.4, 1.7, 1.8]} />
      </mesh>
      <Gable width={2.4} depth={1.8} height={1.15} y={1.7} mat={m.roof} />
      <mesh position={[1.15, 0.75, 0.2]} material={m.wall2} castShadow>
        <boxGeometry args={[0.9, 1.5, 1.3]} />
      </mesh>
      <mesh position={[-0.55, 1.0, 0.91]} material={night || tone === "color" ? m.warm : m.win}>
        <boxGeometry args={[0.6, 0.45, 0.02]} />
      </mesh>
      <mesh position={[0.35, 0.5, 0.91]} material={m.door}>
        <boxGeometry args={[0.42, 1.0, 0.02]} />
      </mesh>
      <mesh position={[0.35, 0.06, 1.2]} material={m.metal}>
        <boxGeometry args={[0.7, 0.06, 0.5]} />
      </mesh>
    </group>
  );
}

export function BarnModel({ tone = "color" }: { tone?: Tone }) {
  const m = useMats(tone);
  return (
    <group>
      <mesh position={[0, 0.9, 0]} material={m.wall} castShadow>
        <boxGeometry args={[2.2, 1.8, 2]} />
      </mesh>
      <Gable width={2.2} depth={2} height={1.3} y={1.8} mat={m.roof} />
      <mesh position={[0, 0.6, 1.01]} material={m.door}>
        <boxGeometry args={[0.9, 1.2, 0.02]} />
      </mesh>
      <mesh position={[0, 1.95, 1.01]} material={m.win}>
        <boxGeometry args={[0.38, 0.28, 0.02]} />
      </mesh>
      {/* silo */}
      <group position={[1.75, 0, -0.3]}>
        <mesh position={[0, 1.4, 0]} material={m.metal} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 2.8, 32]} />
        </mesh>
        {[0.5, 1.0, 1.5, 2.0, 2.5].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={m.roof}>
            <torusGeometry args={[0.43, 0.018, 8, 48]} />
          </mesh>
        ))}
        <mesh position={[0, 2.95, 0]} material={m.metal}>
          <sphereGeometry args={[0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
    </group>
  );
}

export function ClassroomModel() {
  const m = useMats("mono");
  const chairs = [];
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const x = (c - 1) * 1.6;
      const z = r * 1.7 - 0.6;
      chairs.push(
        <group key={`${r}${c}`} position={[x, 0, z]}>
          <mesh position={[0, 0.55, 0]} material={m.warm}>
            <cylinderGeometry args={[0.45, 0.45, 0.06, 32]} />
          </mesh>
          <mesh position={[0, 0.27, 0]} material={m.metal}>
            <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
          </mesh>
          {[-0.6, 0.6].map((dx) => (
            <group key={dx} position={[dx, 0, 0.25]}>
              <mesh position={[0, 0.35, 0]} material={m.wall2}>
                <boxGeometry args={[0.42, 0.08, 0.42]} />
              </mesh>
              <mesh position={[0, 0.62, -0.2]} material={m.wall2}>
                <boxGeometry args={[0.42, 0.5, 0.06]} />
              </mesh>
              <mesh position={[0, 0.16, 0]} material={m.metal}>
                <boxGeometry args={[0.36, 0.32, 0.36]} />
              </mesh>
            </group>
          ))}
        </group>,
      );
    }
  return <group>{chairs}</group>;
}

/** Edge AI server: two stacked rack units with glowing status strips */
export function ServerModel() {
  const m = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ color: "#05070e", roughness: 0.25, metalness: 0.85, clearcoat: 1 }),
      top: new THREE.MeshPhysicalMaterial({ color: "#1d5bff", roughness: 0.25, metalness: 0.6, clearcoat: 1, emissive: "#0b2a8a", emissiveIntensity: 0.4 }),
      strip: new THREE.MeshStandardMaterial({ color: "#a5f3fc", emissive: "#67e8f9", emissiveIntensity: 2.2, toneMapped: false }),
      rim: new THREE.MeshStandardMaterial({ color: "#c7d2fe", emissive: "#93c5fd", emissiveIntensity: 1.2, toneMapped: false }),
    }),
    [],
  );
  const unit = (y: number, top: boolean) => (
    <group position={[0, y, 0]}>
      <mesh material={m.body} castShadow>
        <boxGeometry args={[2.6, 0.55, 1.7]} />
      </mesh>
      {top && (
        <mesh position={[0, 0.3, 0]} material={m.top}>
          <boxGeometry args={[2.6, 0.06, 1.7]} />
        </mesh>
      )}
      <mesh position={[0, 0.29, 0.86]} material={m.rim}>
        <boxGeometry args={[2.6, 0.015, 0.015]} />
      </mesh>
      {[0.1, -0.1].map((dy, i) => (
        <mesh key={dy} position={[-0.45 + i * 0.02, dy, 0.86]} material={m.strip}>
          <boxGeometry args={[1.3, 0.035, 0.01]} />
        </mesh>
      ))}
      <mesh position={[1.05, 0, 0.86]} material={m.strip}>
        <sphereGeometry args={[0.05, 16, 16]} />
      </mesh>
    </group>
  );
  return (
    <group>
      {unit(0.32, true)}
      {unit(-0.3, false)}
    </group>
  );
}
