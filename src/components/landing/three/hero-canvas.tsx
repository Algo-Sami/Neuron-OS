"use client";

import React, { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { NeuralCoreScene } from "./neural-core";

function subscribe() {
  return () => {};
}

function WebGLFallback() {
  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
      <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center">
        {/* Soft pastel ambient halo */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-200/40 via-sky-300/30 to-indigo-200/30 blur-3xl opacity-60 animate-pulse" />
        <div className="absolute inset-6 rounded-full border border-sky-300/40 animate-ping opacity-20" />
      </div>
    </div>
  );
}

function checkWebGLSupport() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function HeroCanvas() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [hasWebGL] = useState(checkWebGLSupport);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check mobile breakpoint
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener("resize", checkSize, { passive: true });
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (!mounted || !hasWebGL) {
    return <WebGLFallback />;
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none opacity-35 sm:opacity-40 transition-opacity duration-700">
      <Canvas
        camera={{ position: [0, 0, 7.2], fov: isMobile ? 54 : 44 }}
        dpr={[1, typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 1.5) : 1]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="w-full h-full pointer-events-none"
      >
        <Suspense fallback={null}>
          {/* Pristine Light Scene Lighting Rig */}
          <ambientLight intensity={1.5} />
          <directionalLight position={[6, 9, 5]} intensity={2.4} color="#f0f9ff" />
          <directionalLight position={[-6, -4, -3]} intensity={1.3} color="#e0e7ff" />
          <pointLight position={[0, 0.45, 0]} intensity={3} color="#0ea5e9" distance={9} />
          <pointLight position={[4, 4, 3]} intensity={1.6} color="#38bdf8" />

          <NeuralCoreScene isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
