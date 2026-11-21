"use client";

import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";

interface NeuralCoreProps {
  isMobile?: boolean;
}

export function NeuralCoreScene({ isMobile = false }: NeuralCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const innerNucleusRef = useRef<THREE.Mesh>(null);
  const outerCageRef = useRef<THREE.Mesh>(null);
  const orbitRingRef = useRef<THREE.Group>(null);
  const satellitesRef = useRef<THREE.Group>(null);

  // Satellite node definitions with semantic academic colors
  const satellites = useMemo(() => [
    { label: "Document", color: "#38bdf8", radius: 2.3, speed: 0.6, yOffset: 0.2, phase: 0 },
    { label: "Vector", color: "#818cf8", radius: 2.7, speed: -0.45, yOffset: -0.3, phase: Math.PI * 0.5 },
    { label: "Quiz", color: "#34d399", radius: 2.4, speed: 0.55, yOffset: 0.5, phase: Math.PI },
    { label: "Schedule", color: "#f472b6", radius: 2.8, speed: -0.4, yOffset: -0.4, phase: Math.PI * 1.5 },
  ], []);

  // Synaptic vertices positions for outer neural cage
  const cageGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.65, 1), []);
  const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.2, 2), []);
  const coreGeometry = useMemo(() => new THREE.SphereGeometry(0.75, 24, 24), []);
  const satelliteGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.18, 0), []);
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(2.5, 0.012, 16, 80), []);

  // Frame animation loop - ZERO React re-renders, direct ref mutations
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const pointer = state.pointer;

    // Smooth cursor-driven parallax tilting
    if (groupRef.current) {
      const targetRotationY = pointer.x * 0.45 + t * 0.08;
      const targetRotationX = -pointer.y * 0.35 + Math.sin(t * 0.4) * 0.05;
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotationY, 3, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotationX, 3, delta);
    }

    // Gentle core counter-rotations and energy pulsation
    if (coreRef.current) {
      coreRef.current.rotation.y = -t * 0.3;
      coreRef.current.rotation.z = t * 0.2;
      const pulse = 1 + Math.sin(t * 2.2) * 0.06;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    if (innerNucleusRef.current) {
      innerNucleusRef.current.rotation.x = t * 0.25;
      innerNucleusRef.current.rotation.y = -t * 0.2;
      const innerPulse = 1 + Math.sin(t * 3.0 + 1) * 0.08;
      innerNucleusRef.current.scale.set(innerPulse, innerPulse, innerPulse);
    }

    if (outerCageRef.current) {
      outerCageRef.current.rotation.y = t * 0.15;
      outerCageRef.current.rotation.z = -t * 0.1;
    }

    if (orbitRingRef.current) {
      orbitRingRef.current.rotation.z = t * 0.12;
      orbitRingRef.current.rotation.x = Math.PI * 0.25 + Math.sin(t * 0.3) * 0.05;
    }

    // Orbiting satellite positions
    if (satellitesRef.current) {
      satellitesRef.current.children.forEach((child, i) => {
        const sat = satellites[i];
        if (sat) {
          const angle = t * sat.speed + sat.phase;
          child.position.x = Math.cos(angle) * sat.radius;
          child.position.z = Math.sin(angle) * sat.radius;
          child.position.y = Math.sin(t * 1.2 + sat.phase) * 0.25 + sat.yOffset;
          child.rotation.x += delta * 1.2;
          child.rotation.y += delta * 1.5;
        }
      });
    }
  });

  return (
    <group ref={groupRef} scale={isMobile ? 0.78 : 1.05} position={[0, 0, 0]}>
      {/* Floating wrapper for organic breathing motion */}
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.4}>
        
        {/* Core Glowing Nucleus */}
        <mesh ref={coreRef} geometry={coreGeometry}>
          <meshStandardMaterial
            color="#0284c7"
            emissive="#00f0ff"
            emissiveIntensity={1.8}
            roughness={0.15}
            metalness={0.8}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Inner Faceted Energy Shell */}
        <mesh ref={innerNucleusRef} geometry={innerGeometry}>
          <meshStandardMaterial
            color="#1e1b4b"
            emissive="#818cf8"
            emissiveIntensity={1.2}
            wireframe
            transparent
            opacity={0.45}
          />
        </mesh>

        {/* Outer Synaptic Geodesic Cage */}
        <mesh ref={outerCageRef} geometry={cageGeometry}>
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.9}
            wireframe
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Planetary Synaptic Orbit Rings */}
        <group ref={orbitRingRef}>
          <mesh geometry={ringGeometry}>
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} />
          </mesh>
          <mesh geometry={ringGeometry} rotation={[Math.PI * 0.4, 0, 0]} scale={0.9}>
            <meshBasicMaterial color="#818cf8" transparent opacity={0.18} />
          </mesh>
        </group>

        {/* Orbiting Satellite Knowledge Nodes */}
        <group ref={satellitesRef}>
          {satellites.map((sat, idx) => (
            <mesh key={idx} geometry={satelliteGeometry}>
              <meshStandardMaterial
                color={sat.color}
                emissive={sat.color}
                emissiveIntensity={1.8}
                roughness={0.2}
                metalness={0.8}
              />
            </mesh>
          ))}
        </group>

        {/* Ambient Synaptic Dust Particles */}
        <Sparkles
          count={isMobile ? 24 : 55}
          scale={isMobile ? 5 : 7}
          size={isMobile ? 2.5 : 3.5}
          speed={0.4}
          opacity={0.65}
          color="#38bdf8"
        />

        {/* Subtle Violet Background Particles */}
        <Sparkles
          count={isMobile ? 15 : 35}
          scale={isMobile ? 6 : 8.5}
          size={isMobile ? 3 : 4.5}
          speed={0.25}
          opacity={0.4}
          color="#a855f7"
        />
      </Float>
    </group>
  );
}
