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
      <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
        {/* Soft pastel ambient halo */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-200/50 via-sky-300/40 to-indigo-200/40 blur-2xl opacity-70 animate-pulse" />
        <div className="absolute inset-2 rounded-full border border-sky-300/60 animate-ping opacity-25" />
        <div className="relative z-10 w-24 h-24 rounded-full border border-sky-400/50 bg-white/80 backdrop-blur-md flex items-center justify-center shadow-[0_10px_30px_rgba(14,165,233,0.18)]">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 animate-spin" style={{ animationDuration: "8s" }} />
        </div>
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

  if (!mounted) {
    return <WebGLFallback />;
  }

  if (!hasWebGL) {
    return <WebGLFallback />;
  }

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[380px] lg:min-h-[440px] flex items-center justify-center">
      <Canvas
        camera={{ position: [0, 0, 5.8], fov: isMobile ? 52 : 46 }}
        dpr={[1, typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="pointer-events-auto"
      >
        <Suspense fallback={null}>
          {/* Pristine Light Scene Lighting Rig */}
          <ambientLight intensity={1.4} />
          <directionalLight position={[5, 8, 4]} intensity={2.2} color="#f0f9ff" />
          <directionalLight position={[-5, -3, -3]} intensity={1.2} color="#e0e7ff" />
          <pointLight position={[0, 0, 0]} intensity={2.5} color="#0ea5e9" distance={6} />
          <pointLight position={[3, 3, 2]} intensity={1.5} color="#38bdf8" />

          <NeuralCoreScene isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
