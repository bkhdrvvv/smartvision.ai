"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useDeviceTier, useWebGL } from "./hooks";
import { cn } from "@/lib/format";

type Props = {
  children: ReactNode;
  className?: string;
  camera?: CanvasProps["camera"];
  fallback?: ReactNode;
  /** px margin before entering viewport to mount the canvas */
  mountMargin?: string;
  eager?: boolean;
  onCreated?: CanvasProps["onCreated"];
};

/**
 * Lazily-mounted, visibility-paused R3F canvas with adaptive DPR and
 * WebGL fallback. Every 3D scene on the site goes through this wrapper.
 */
export function Scene3D({ children, className, camera, fallback, mountMargin = "400px", eager, onCreated }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(!!eager);
  const [visible, setVisible] = useState(!!eager);
  const webgl = useWebGL();
  const tier = useDeviceTier();
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    setDpr(tier === "low" ? 1 : Math.min(window.devicePixelRatio, 1.75));
  }, [tier]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mountIo = new IntersectionObserver(([e]) => e.isIntersecting && setMounted(true), { rootMargin: mountMargin });
    const visIo = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "80px" });
    mountIo.observe(el);
    visIo.observe(el);
    return () => {
      mountIo.disconnect();
      visIo.disconnect();
    };
  }, [mountMargin]);

  return (
    <div ref={ref} className={cn(/\b(absolute|fixed)\b/.test(className ?? "") ? "" : "relative", className)}>
      {webgl === false ? (
        fallback ?? null
      ) : mounted && webgl ? (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={dpr}
          camera={camera ?? { position: [0, 0, 6], fov: 35 }}
          gl={{ antialias: tier !== "low", alpha: true, powerPreference: "high-performance" }}
          onCreated={onCreated}
          style={{ touchAction: "pan-y" }}
        >
          <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr((d) => Math.min(d + 0.25, 1.75))} />
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      ) : null}
    </div>
  );
}
