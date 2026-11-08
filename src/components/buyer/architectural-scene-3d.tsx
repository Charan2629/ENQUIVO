"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Sparkles, Compass } from "lucide-react";

export function ArchitecturalScene3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Setup Three.js Scene
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setHasWebGL(false));
      return;
    }

    const scene = new THREE.Scene();

    // Orthographic-style Perspective Camera for elegant isometric angle
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 480;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(28, 22, 28);
    camera.lookAt(0, 4, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Master Group
    const cityGroup = new THREE.Group();
    scene.add(cityGroup);

    // --- Materials (ENQUIVO Palette) ---
    // Deep Ocean Facade
    const oceanFacadeMat = new THREE.MeshStandardMaterial({
      color: 0x102f43,
      roughness: 0.25,
      metalness: 0.2,
    });

    // Dark Blue-Green Secondary Facade
    const bluegreenMat = new THREE.MeshStandardMaterial({
      color: 0x183442,
      roughness: 0.4,
      metalness: 0.1,
    });

    // Champagne Gold Architectural Finishes / Mullions
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd6b56d,
      roughness: 0.3,
      metalness: 0.8,
    });

    // Jade Teal Podium / Water Feature
    const tealWaterMat = new THREE.MeshStandardMaterial({
      color: 0x13a99a,
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
    });

    // Pale Aqua Glass Balconies
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe7f4f4,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 0.5,
    });

    // Porcelain Concrete Base
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0xf7f8f4,
      roughness: 0.8,
      metalness: 0.05,
    });

    // Landscaping Turf
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x1b4332,
      roughness: 0.9,
    });

    // --- Geometry Construction ---

    // 1. Ground Podium (Porcelain Base)
    const baseGeo = new THREE.BoxGeometry(22, 0.8, 22);
    const baseMesh = new THREE.Mesh(baseGeo, podiumMat);
    baseMesh.position.y = -0.4;
    baseMesh.receiveShadow = true;
    cityGroup.add(baseMesh);

    // 2. Reflective Water Feature / Lap Pool
    const poolGeo = new THREE.BoxGeometry(10, 0.15, 4);
    const poolMesh = new THREE.Mesh(poolGeo, tealWaterMat);
    poolMesh.position.set(-3, 0.08, 6);
    cityGroup.add(poolMesh);

    // 3. Garden Courtyard
    const gardenGeo = new THREE.BoxGeometry(6, 0.1, 7);
    const gardenMesh = new THREE.Mesh(gardenGeo, greenMat);
    gardenMesh.position.set(5, 0.05, 5);
    cityGroup.add(gardenMesh);

    // 4. Tower 1 (Prakriti Heights representation — High-rise stepped architecture)
    const tower1Levels = [
      { w: 5.5, h: 7, d: 5.5, x: -3.5, y: 3.5, z: -2 },
      { w: 4.8, h: 5.5, d: 4.8, x: -3.5, y: 9.75, z: -2 },
      { w: 3.8, h: 4, d: 3.8, x: -3.5, y: 14.5, z: -2 },
    ];

    tower1Levels.forEach((lvl, idx) => {
      const geo = new THREE.BoxGeometry(lvl.w, lvl.h, lvl.d);
      const mesh = new THREE.Mesh(geo, idx === 0 ? oceanFacadeMat : bluegreenMat);
      mesh.position.set(lvl.x, lvl.y, lvl.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cityGroup.add(mesh);

      // Gold crown / trim band
      const trimGeo = new THREE.BoxGeometry(lvl.w + 0.15, 0.25, lvl.d + 0.15);
      const trimMesh = new THREE.Mesh(trimGeo, goldMat);
      trimMesh.position.set(lvl.x, lvl.y + lvl.h / 2, lvl.z);
      cityGroup.add(trimMesh);

      // Glass Balcony Wrap
      const balconyGeo = new THREE.BoxGeometry(lvl.w + 0.3, 0.6, 0.8);
      const balconyMesh = new THREE.Mesh(balconyGeo, glassMat);
      balconyMesh.position.set(lvl.x, lvl.y - lvl.h / 4, lvl.z + lvl.d / 2 + 0.3);
      cityGroup.add(balconyMesh);
    });

    // 5. Tower 2 (Vaastu Enclave representation — Twin interconnected biophilic block)
    const tower2Levels = [
      { w: 6.5, h: 5.5, d: 4.5, x: 4.5, y: 2.75, z: -1.5 },
      { w: 5.5, h: 5, d: 4, x: 4.5, y: 8, z: -1.5 },
    ];

    tower2Levels.forEach((lvl) => {
      const geo = new THREE.BoxGeometry(lvl.w, lvl.h, lvl.d);
      const mesh = new THREE.Mesh(geo, bluegreenMat);
      mesh.position.set(lvl.x, lvl.y, lvl.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cityGroup.add(mesh);

      // Gold cornice
      const corniceGeo = new THREE.BoxGeometry(lvl.w + 0.2, 0.2, lvl.d + 0.2);
      const cornice = new THREE.Mesh(corniceGeo, goldMat);
      cornice.position.set(lvl.x, lvl.y + lvl.h / 2, lvl.z);
      cityGroup.add(cornice);

      // Wrap-around cantilevered glass terrace
      const terrGeo = new THREE.BoxGeometry(0.8, 0.5, lvl.d + 0.2);
      const terrMesh = new THREE.Mesh(terrGeo, glassMat);
      terrMesh.position.set(lvl.x + lvl.w / 2 + 0.3, lvl.y, lvl.z);
      cityGroup.add(terrMesh);
    });

    // 6. Skybridge / Elevated Green Link between developments
    const bridgeGeo = new THREE.BoxGeometry(3.5, 0.4, 1.8);
    const bridgeMesh = new THREE.Mesh(bridgeGeo, goldMat);
    bridgeMesh.position.set(0.5, 5.5, -1.8);
    bridgeMesh.castShadow = true;
    cityGroup.add(bridgeMesh);

    // 7. Architectural Landscape Elements (Trees / Planters)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 8.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.2, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 0.6, z);
      cityGroup.add(trunk);

      const foliageGeo = new THREE.DodecahedronGeometry(0.75, 1);
      const foliage = new THREE.Mesh(foliageGeo, greenMat);
      foliage.position.set(x, 1.6, z);
      foliage.castShadow = true;
      cityGroup.add(foliage);
    }

    // --- Lighting ---
    // Ambient light with soft pale aqua tint
    const ambientLight = new THREE.AmbientLight(0xe7f4f4, 1.4);
    scene.add(ambientLight);

    // Warm Sun Directional Light (Champagne Gold highlight)
    const sunLight = new THREE.DirectionalLight(0xfff6e0, 2.2);
    sunLight.position.set(24, 32, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -16;
    sunLight.shadow.camera.right = 16;
    sunLight.shadow.camera.top = 16;
    sunLight.shadow.camera.bottom = -16;
    scene.add(sunLight);

    // Soft Teal Accent Fill Light from below
    const tealFill = new THREE.DirectionalLight(0x13a99a, 0.8);
    tealFill.position.set(-15, 10, -10);
    scene.add(tealFill);

    // Pointer Interaction State
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 0.8;
      mouseY = y * 0.4;
    };

    const handleMouseLeave = () => {
      mouseX = 0;
      mouseY = 0;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Responsive Resize Handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (!prefersReducedMotion) {
        // Slow subtle auto-rotation + damped mouse tracking
        cityGroup.rotation.y += delta * 0.08;
      }

      // Smooth lerp to mouse targets
      targetRotationY = mouseX * 0.5;
      targetRotationX = mouseY * 0.3;

      cityGroup.rotation.y += (targetRotationY - cityGroup.rotation.y * 0.05) * 0.05;
      cityGroup.rotation.x = THREE.MathUtils.lerp(cityGroup.rotation.x, targetRotationX, 0.05);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      renderer.dispose();

      // Clean up geometries and materials
      cityGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[400px] sm:h-[480px] lg:h-[540px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#102F43]/5 via-[#E7F4F4]/20 to-[#F7F8F4] border border-[#102F43]/10 shadow-2xl flex items-center justify-center group"
    >
      {/* Fallback composition if WebGL unavailable */}
      {!hasWebGL ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#102F43] flex items-center justify-center text-[#D6B56D] mb-4">
            <Compass className="w-8 h-8 animate-pulse" />
          </div>
          <h4 className="font-serif text-xl font-semibold text-[#102F43]">
            Architectural Massing Study
          </h4>
          <p className="mt-2 text-xs text-[#183442]/70 max-w-sm">
            Interactive 3D geometry visualizing Prakriti Heights & Vaastu Enclave high-rise density.
          </p>
        </div>
      ) : (
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      )}

      {/* Floating Badges & Legend */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#102F43]/90 text-[#F7F8F4] backdrop-blur-md text-[11px] font-medium border border-white/10 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#13A99A] animate-pulse" />
          3D Interactive Massing
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 text-[#102F43] text-[10px] font-semibold border border-[#102F43]/10">
          <Sparkles className="w-3 h-3 text-[#D6B56D]" />
          Ahmedabad Corridors
        </span>
      </div>

      {/* Bottom Architectural Notation */}
      <div className="absolute bottom-4 inset-x-4 z-10 flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-2xl bg-[#102F43]/85 text-[#F7F8F4] backdrop-blur-md border border-white/10 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D6B56D]" />
          <span className="font-medium text-white/95">
            Prakriti Heights (SG Highway) & Vaastu Enclave (Shela)
          </span>
        </div>
        <div className="text-[10px] text-[#E7F4F4]/80 text-center sm:text-right">
          <span>Conceptual Architectural Geometry • Move cursor to inspect angles</span>
        </div>
      </div>
    </div>
  );
}
