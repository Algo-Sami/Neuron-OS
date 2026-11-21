"use client";

import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";

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
  const particlesRef = useRef<THREE.Points>(null);

  // Global cursor & scroll trackers for full-section interactivity
  const mouseRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef(0);

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      // Normalized device coordinates (-1 to 1)
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    // Initialize scroll position
    scrollRef.current = window.scrollY;

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Knowledge Satellite nodes spanning wider spatial radii
  const satellites = useMemo(
    () => [
      { color: "#0284c7", radius: isMobile ? 2.2 : 2.8, speed: 0.45, yOffset: 0.25, phase: 0 },
      { color: "#6366f1", radius: isMobile ? 2.5 : 3.3, speed: -0.38, yOffset: -0.3, phase: Math.PI * 0.4 },
      { color: "#059669", radius: isMobile ? 2.3 : 2.9, speed: 0.42, yOffset: 0.4, phase: Math.PI * 0.8 },
      { color: "#d946ef", radius: isMobile ? 2.6 : 3.6, speed: -0.32, yOffset: -0.4, phase: Math.PI * 1.3 },
      { color: "#0ea5e9", radius: isMobile ? 2.8 : 3.9, speed: 0.35, yOffset: 0.15, phase: Math.PI * 1.7 },
      { color: "#f59e0b", radius: isMobile ? 2.4 : 3.1, speed: -0.42, yOffset: -0.15, phase: Math.PI * 0.2 },
    ],
    [isMobile]
  );

  // Geometries scaled to anchor a full-width hero backdrop
  const cageGeometry = useMemo(() => new THREE.IcosahedronGeometry(isMobile ? 1.6 : 2.1, 1), [isMobile]);
  const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(isMobile ? 1.15 : 1.45, 2), [isMobile]);
  const coreGeometry = useMemo(() => new THREE.SphereGeometry(isMobile ? 0.75 : 0.95, 32, 32), [isMobile]);
  const satelliteGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.14, 0), []);
  const ringGeometry1 = useMemo(() => new THREE.TorusGeometry(isMobile ? 2.4 : 3.1, 0.012, 16, 120), [isMobile]);
  const ringGeometry2 = useMemo(() => new THREE.TorusGeometry(isMobile ? 2.8 : 3.7, 0.01, 16, 120), [isMobile]);
  const ringGeometry3 = useMemo(() => new THREE.TorusGeometry(isMobile ? 3.2 : 4.3, 0.008, 16, 120), [isMobile]);

  // Subtle ambient spatial dust particles
  const particlesGeometry = useMemo(() => {
    const count = isMobile ? 30 : 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (isMobile ? 8 : 16);
      positions[i * 3 + 1] = (Math.random() - 0.5) * (isMobile ? 6 : 10);
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [isMobile]);

  // Frame animation loop - direct ref mutations, zero re-renders
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const sy = scrollRef.current;

    // Smooth cursor-driven tilt + scroll parallax across the entire hero section
    if (groupRef.current) {
      const targetRotationY = mx * 0.45 + t * 0.05;
      const targetRotationX = -my * 0.35 + Math.sin(t * 0.3) * 0.04;
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotationY, 3, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotationX, 3, delta);

      // Scroll response: smoothly glides downward and recedes in 3D depth as user scrolls
      const targetPosY = (isMobile ? 0.55 : 0.9) - sy * 0.0022;
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetPosY, 3.5, delta);
      const targetPosZ = -0.3 - sy * 0.0008;
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetPosZ, 3.5, delta);
    }

    // Core rotations and gentle breathing pulsation
    if (coreRef.current) {
      coreRef.current.rotation.y = -t * 0.22;
      coreRef.current.rotation.z = t * 0.16;
      const pulse = 1 + Math.sin(t * 2) * 0.035;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    if (innerNucleusRef.current) {
      innerNucleusRef.current.rotation.x = t * 0.18;
      innerNucleusRef.current.rotation.y = -t * 0.14;
      const innerPulse = 1 + Math.sin(t * 2.4 + 1) * 0.05;
      innerNucleusRef.current.scale.set(innerPulse, innerPulse, innerPulse);
    }

    if (outerCageRef.current) {
      outerCageRef.current.rotation.y = t * 0.1;
      outerCageRef.current.rotation.x = Math.sin(t * 0.18) * 0.08;
    }

    if (orbitRingRef.current) {
      orbitRingRef.current.rotation.z = t * 0.06;
      orbitRingRef.current.rotation.x = Math.cos(t * 0.12) * 0.12;
    }

    // Satellite orbital mechanics
    if (satellitesRef.current) {
      satellitesRef.current.children.forEach((child, index) => {
        const sat = satellites[index];
        if (!sat) return;
        const angle = t * sat.speed + sat.phase;
        child.position.x = Math.cos(angle) * sat.radius;
        child.position.z = Math.sin(angle) * sat.radius - 0.25;
        child.position.y = sat.yOffset + Math.sin(t * 1.4 + index) * 0.18;
        child.rotation.x += delta * 0.7;
        child.rotation.y += delta * 1.1;
      });
    }

    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.012;
      particlesRef.current.rotation.x = Math.sin(t * 0.1) * 0.01;
    }
  });

  return (
    <group ref={groupRef} position={[0, isMobile ? 0.55 : 0.9, -0.3]}>
      <Float speed={1.6} rotationIntensity={0.2} floatIntensity={0.5}>
        {/* Central Luminous Nucleus (Cyan-Blue Light Theme) */}
        <mesh ref={innerNucleusRef} geometry={innerGeometry}>
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#38bdf8"
            emissiveIntensity={0.65}
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
            emissiveIntensity={0.3}
            roughness={0.15}
            metalness={0.1}
            clearcoat={1}
            clearcoatRoughness={0.1}
            transmission={0.85}
            ior={1.4}
            thickness={1.2}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* Outer Synaptic Geometric Cage */}
        <mesh ref={outerCageRef} geometry={cageGeometry}>
          <meshStandardMaterial
            color="#0284c7"
            wireframe
            transparent
            opacity={0.32}
            roughness={0.4}
          />
        </mesh>

        {/* Triple Orbital Guidance Rings */}
        <group ref={orbitRingRef}>
          <mesh geometry={ringGeometry1} rotation={[Math.PI / 3, Math.PI / 6, 0]}>
            <meshStandardMaterial
              color="#0ea5e9"
              transparent
              opacity={0.38}
              roughness={0.3}
            />
          </mesh>
          <mesh geometry={ringGeometry2} rotation={[-Math.PI / 4, 0, Math.PI / 5]}>
            <meshStandardMaterial
              color="#6366f1"
              transparent
              opacity={0.28}
              roughness={0.3}
            />
          </mesh>
          <mesh geometry={ringGeometry3} rotation={[Math.PI / 6, -Math.PI / 4, Math.PI / 3]}>
            <meshStandardMaterial
              color="#0284c7"
              transparent
              opacity={0.2}
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

        {/* Ambient Spatial Dust Particles */}
        <points ref={particlesRef} geometry={particlesGeometry}>
          <pointsMaterial
            size={0.05}
            color="#38bdf8"
            transparent
            opacity={0.45}
            sizeAttenuation
          />
        </points>
      </Float>
    </group>
  );
}
