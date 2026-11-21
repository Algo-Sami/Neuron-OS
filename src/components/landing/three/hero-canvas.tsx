"use client";

import React, { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { NeuralCoreScene } from "./neural-core";

function subscribe() {
  return () => {};
}

function WebGLFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none relative">
      <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* Outer pulsating radial ring */}
        <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-25" />
        <div className="absolute inset-4 rounded-full border border-blue-500/40 animate-pulse" />
        {/* Core glowing orb */}
        <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-blue-600 via-cyan-400 to-indigo-600 blur-xl opacity-60 animate-pulse" />
        <div className="relative z-10 w-28 h-28 rounded-full border border-cyan-300/60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center shadow-[0_0_50px_rgba(56,189,248,0.4)]">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 animate-spin" />
        </div>
      </div>
    </div>
  );
}

export function HeroCanvas() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check mobile breakpoint
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener("resize", checkSize, { passive: true });

    // Detect WebGL capability safely
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setHasWebGL(Boolean(gl));
    } catch {
      setHasWebGL(false);
    }

    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (!mounted) {
    return <WebGLFallback />;
  }

  if (!hasWebGL) {
    return <WebGLFallback />;
  }

  return (
    <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none">
      <Canvas
        camera={{
          position: [0, 0, isMobile ? 6.2 : 5.4],
          fov: isMobile ? 50 : 45,
          near: 0.1,
          far: 50,
        }}
        dpr={[1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="w-full h-full !absolute inset-0"
      >
        {/* Lighting setup */}
        <ambientLight intensity={0.7} color="#0b1329" />
        <directionalLight position={[6, 8, 5]} intensity={2.6} color="#38bdf8" />
        <pointLight position={[-6, -4, 3]} intensity={1.8} color="#0078d4" />
        <pointLight position={[0, 5, -6]} intensity={3.2} color="#a855f7" />

        <Suspense fallback={null}>
          <NeuralCoreScene isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
