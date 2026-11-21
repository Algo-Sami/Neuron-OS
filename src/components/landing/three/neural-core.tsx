"use client";

import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";

interface NeuralCoreProps {
  isMobile?: boolean;
}

export function NeuralCoreScene({ isMobile: _isMobile = false }: NeuralCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const innerNucleusRef = useRef<THREE.Mesh>(null);
  const outerCageRef = useRef<THREE.Mesh>(null);
  const orbitRingRef = useRef<THREE.Group>(null);
  const satellitesRef = useRef<THREE.Group>(null);

  // Satellite node definitions with semantic academic colors (optimized for light theme)
  const satellites = useMemo(
    () => [
      { label: "Document", color: "#0284c7", radius: 2.2, speed: 0.5, yOffset: 0.2, phase: 0 },
      { label: "Vector", color: "#6366f1", radius: 2.6, speed: -0.4, yOffset: -0.3, phase: Math.PI * 0.5 },
      { label: "Quiz", color: "#059669", radius: 2.3, speed: 0.45, yOffset: 0.4, phase: Math.PI },
      { label: "Schedule", color: "#d946ef", radius: 2.7, speed: -0.35, yOffset: -0.35, phase: Math.PI * 1.5 },
    ],
    []
  );

  // Geometries
  const cageGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.6, 1), []);
  const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.15, 2), []);
  const coreGeometry = useMemo(() => new THREE.SphereGeometry(0.72, 32, 32), []);
  const satelliteGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.18, 0), []);
  const ringGeometry1 = useMemo(() => new THREE.TorusGeometry(2.35, 0.012, 16, 96), []);
  const ringGeometry2 = useMemo(() => new THREE.TorusGeometry(2.7, 0.01, 16, 96), []);

  // Frame animation loop - ZERO React re-renders, direct ref mutations
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const pointer = state.pointer;

    // Smooth cursor-driven parallax tilting
    if (groupRef.current) {
      const targetRotationY = pointer.x * 0.4 + t * 0.06;
      const targetRotationX = -pointer.y * 0.3 + Math.sin(t * 0.3) * 0.04;
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotationY, 3, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotationX, 3, delta);
    }

    // Core rotations and gentle breathing pulsation
    if (coreRef.current) {
      coreRef.current.rotation.y = -t * 0.25;
      coreRef.current.rotation.z = t * 0.18;
      const pulse = 1 + Math.sin(t * 2) * 0.04;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    if (innerNucleusRef.current) {
      innerNucleusRef.current.rotation.x = t * 0.2;
      innerNucleusRef.current.rotation.y = -t * 0.15;
      const innerPulse = 1 + Math.sin(t * 2.6 + 1) * 0.06;
      innerNucleusRef.current.scale.set(innerPulse, innerPulse, innerPulse);
    }

    if (outerCageRef.current) {
      outerCageRef.current.rotation.y = t * 0.12;
      outerCageRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    }

    if (orbitRingRef.current) {
      orbitRingRef.current.rotation.z = t * 0.08;
      orbitRingRef.current.rotation.x = Math.cos(t * 0.15) * 0.15;
    }

    // Satellite orbital mechanics
    if (satellitesRef.current) {
      satellitesRef.current.children.forEach((child, index) => {
        const sat = satellites[index];
        if (!sat) return;
        const angle = t * sat.speed + sat.phase;
        child.position.x = Math.cos(angle) * sat.radius;
        child.position.z = Math.sin(angle) * sat.radius;
        child.position.y = sat.yOffset + Math.sin(t * 1.5 + index) * 0.15;
        child.rotation.x += delta * 0.8;
        child.rotation.y += delta * 1.2;
      });
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.6}>
        {/* Central Luminous Nucleus (Cyan-Blue Light Theme) */}
        <mesh ref={innerNucleusRef} geometry={innerGeometry}>
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#38bdf8"
            emissiveIntensity={0.7}
            roughness={0.25}
            metalness={0.2}
            wireframe
          />
        </mesh>

        {/* Central Crystal Core */}
        <mesh ref={coreRef} geometry={coreGeometry}>
          <meshPhysicalMaterial
            color="#e0f2fe"
            emissive="#0284c7"
            emissiveIntensity={0.35}
            roughness={0.15}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.1}
            transmission={0.8}
            ior={1.4}
            thickness={1}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Outer Synaptic Geometric Cage */}
        <mesh ref={outerCageRef} geometry={cageGeometry}>
          <meshStandardMaterial
            color="#0284c7"
            wireframe
            transparent
            opacity={0.35}
            roughness={0.4}
          />
        </mesh>

        {/* Orbit Rings */}
        <group ref={orbitRingRef}>
          <mesh geometry={ringGeometry1} rotation={[Math.PI / 3, Math.PI / 6, 0]}>
            <meshStandardMaterial
              color="#0ea5e9"
              transparent
              opacity={0.4}
              roughness={0.3}
            />
          </mesh>
          <mesh geometry={ringGeometry2} rotation={[-Math.PI / 4, 0, Math.PI / 5]}>
            <meshStandardMaterial
              color="#6366f1"
              transparent
              opacity={0.3}
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* Orbiting Satellite Knowledge Nodes */}
        <group ref={satellitesRef}>
          {satellites.map((sat, i) => (
            <mesh key={i} geometry={satelliteGeometry}>
              <meshStandardMaterial
                color={sat.color}
                emissive={sat.color}
                emissiveIntensity={0.5}
                roughness={0.2}
                metalness={0.4}
              />
            </mesh>
          ))}
        </group>
      </Float>
    </group>
  );
}
