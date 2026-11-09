"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Sparkles,
  ArrowDown,
  ShieldCheck,
  CheckCircle2,
  Building2,
  ChevronDown,
  ArrowRight,
  Info,
} from "lucide-react";

interface CinematicHeroProps {
  totalApartments?: string;
  priceRange?: string;
}

export function CinematicHero({
  totalApartments = "420",
  priceRange = "₹65L – ₹1.2Cr",
}: CinematicHeroProps) {
  const displayApartments = totalApartments.match(/^\d+/)?.[0] || totalApartments;

  // DOM Container & Stage Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Layer Refs
  const skyRef = useRef<HTMLDivElement>(null);
  const blueSkyRef = useRef<HTMLDivElement>(null);
  const stage3CloudsRef = useRef<HTMLDivElement>(null);
  const cloud1Ref = useRef<HTMLDivElement>(null);
  const cloud2Ref = useRef<HTMLDivElement>(null);
  const headlineLayerRef = useRef<HTMLDivElement>(null);
  const buildingCutoutRef = useRef<HTMLDivElement>(null);
  const projectIdentityRef = useRef<HTMLDivElement>(null);
  const typographyTitleRef = useRef<HTMLHeadingElement>(null);
  const cloudWipeRef = useRef<HTMLDivElement>(null);
  const cloudVeilRef = useRef<HTMLDivElement>(null);
  const portfolioRevealRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  // Direct DOM Refs for 5-Stage Right-side Progress Indicator (Zero React re-renders)
  const step1Ref = useRef<HTMLButtonElement>(null);
  const step2Ref = useRef<HTMLButtonElement>(null);
  const step3Ref = useRef<HTMLButtonElement>(null);
  const step4Ref = useRef<HTMLButtonElement>(null);
  const step5Ref = useRef<HTMLButtonElement>(null);

  // Interactive jump handler for 5-stage progress indicator navigation
  const handleJumpToStep = (stepIndex: number) => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.offsetTop || 0;
    const totalScrollable = containerRef.current.offsetHeight - window.innerHeight;
    const targetProgress = [0.0, 0.28, 0.48, 0.68, 0.90][stepIndex - 1] ?? 0;
    const targetY = containerTop + totalScrollable * targetProgress;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  // Dedicated smooth-scroll handler that works reliably across pinned states and repeated clicks
  const handleScrollTo = (e: React.MouseEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    if (typeof window !== "undefined" && window.history?.pushState) {
      window.history.pushState(null, "", `#${targetId}`);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // =================================================================
      // DESKTOP & TABLET PINNED TIMELINE (>= 768px, no reduced motion)
      // Single continuous timeline, GPU-friendly transforms, zero layout reflows
      // =================================================================
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        if (!containerRef.current || !stageRef.current) return;

        // Explicit 350vh scroll track height for smooth desktop/tablet scrubbing
        containerRef.current.style.height = "350vh";

        // Update right-side 5-stage progress indicator via direct DOM manipulation
        let lastActiveStep = -1;
        const updateProgress = (progress: number) => {
          let currentStep = 1;
          if (progress < 0.20) currentStep = 1;      // 1. Perspective
          else if (progress < 0.40) currentStep = 2; // 2. Architecture Rise
          else if (progress < 0.60) currentStep = 3; // 3. Project Identity
          else if (progress < 0.80) currentStep = 4; // 4. Cloud Immersion
          else currentStep = 5;                      // 5. Portfolio

          // Enforce strict pointer-events guards across stages on every scrub:
          // Stage 1: Headline interactive, Stage 5 portfolio strictly non-interactive
          // Stage 5: Portfolio Reveal interactive, Headline non-interactive
          if (portfolioRevealRef.current) {
            portfolioRevealRef.current.style.pointerEvents = currentStep === 5 ? "auto" : "none";
          }
          if (headlineLayerRef.current) {
            headlineLayerRef.current.style.pointerEvents = currentStep === 1 ? "auto" : "none";
          }

          if (currentStep === lastActiveStep) return;
          lastActiveStep = currentStep;

          const steps = [
            step1Ref.current,
            step2Ref.current,
            step3Ref.current,
            step4Ref.current,
            step5Ref.current,
          ];
          steps.forEach((el, index) => {
            if (!el) return;
            const isActive = index + 1 === currentStep;
            el.setAttribute("data-active", isActive ? "true" : "false");
            if (isActive) {
              el.setAttribute("aria-current", "step");
            } else {
              el.removeAttribute("aria-current");
            }
            const label = el.querySelector("[data-step-label]");
            const bar = el.querySelector("[data-step-bar]");
            if (label) {
              label.className = `text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 ${
                isActive ? "text-[#D6B56D] font-bold" : "text-white/40"
              }`;
            }
            if (bar) {
              bar.className = `h-2 rounded-full transition-all duration-300 ${
                isActive ? "w-6 bg-[#13A99A]" : "w-2 bg-white/20"
              }`;
            }
          });
        };

        // Explicit initial transforms & styles (transforms and opacity only)
        // Building starts lower and positioned rightwards (36vw, 32vh, scale 0.88)
        // so headline, paragraph, and both CTAs are 100% clear and unobstructed at Stage 1.
        gsap.set(buildingCutoutRef.current, {
          x: "36vw",
          y: "32vh",
          scale: 0.88,
          opacity: 1,
          transformOrigin: "center bottom",
          force3D: true,
        });

        gsap.set(headlineLayerRef.current, {
          x: "0vw",
          y: "0vh",
          opacity: 1,
          pointerEvents: "auto",
          force3D: true,
        });

        gsap.set(blueSkyRef.current, { opacity: 0, force3D: true });
        gsap.set(stage3CloudsRef.current, { opacity: 0, y: 30, force3D: true });
        gsap.set(cloud1Ref.current, { x: 0, y: 0, opacity: 0.55, force3D: true });
        gsap.set(cloud2Ref.current, { x: 0, y: 0, opacity: 0.45, force3D: true });

        gsap.set(projectIdentityRef.current, {
          opacity: 0,
          y: 35,
          scale: 0.96,
          pointerEvents: "none",
          force3D: true,
        });

        gsap.set(typographyTitleRef.current, {
          backgroundPosition: "50% 35%",
        });

        gsap.set(cloudWipeRef.current, {
          y: "105vh",
          opacity: 0,
          scale: 1.0,
          force3D: true,
        });

        gsap.set(cloudVeilRef.current, {
          opacity: 0,
          force3D: true,
        });

        gsap.set(portfolioRevealRef.current, {
          opacity: 0,
          y: 40,
          pointerEvents: "none",
          force3D: true,
        });

        gsap.set(scrollIndicatorRef.current, { opacity: 0.9 });

        // MASTER PINNED TIMELINE: exactly 1 timeline, 1 scrollTrigger instance
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.0,
            pin: stageRef.current,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              updateProgress(self.progress);
            },
          },
        });

        // Explicitly initialize Stage 1 ("PERSPECTIVE") indicator at initial frame
        updateProgress(0);

        // ---------------------------------------------------------------
        // STAGE 1 -> STAGE 2: Architecture Rise & Physical Occlusion (0.00 -> 0.32)
        // Building rises up from 32vh to -4vh, glides leftward (36vw -> 0vw),
        // and scales up from 0.88 to 1.18.
        // Full-bleed silhouette physically sweeps across and occludes the headline!
        // ---------------------------------------------------------------
        tl.fromTo(
          buildingCutoutRef.current,
          {
            x: "36vw",
            y: "32vh",
            scale: 0.88,
            opacity: 1,
          },
          {
            x: "0vw",
            y: "-4vh",
            scale: 1.18,
            opacity: 1,
            duration: 0.32,
            ease: "power1.inOut",
          },
          0.0
        );

        // Headline translates upward in parallax as the building overtakes it
        tl.to(
          headlineLayerRef.current,
          {
            y: "-16vh",
            duration: 0.28,
            ease: "power1.out",
          },
          0.0
        );

        // Once partially occluded behind the rising building, headline fades out
        tl.fromTo(
          headlineLayerRef.current,
          {
            opacity: 1,
            pointerEvents: "auto",
          },
          {
            opacity: 0,
            pointerEvents: "none",
            duration: 0.12,
            ease: "power2.in",
          },
          0.16
        );

        // Scroll indicator fades out
        tl.to(
          scrollIndicatorRef.current,
          {
            opacity: 0,
            duration: 0.06,
            ease: "power1.out",
          },
          0.04
        );

        // Distant background clouds drift with gentle parallax
        tl.to(
          cloud1Ref.current,
          {
            x: 180,
            y: -30,
            duration: 0.5,
            ease: "none",
          },
          0.0
        );

        tl.to(
          cloud2Ref.current,
          {
            x: -200,
            y: -25,
            duration: 0.5,
            ease: "none",
          },
          0.0
        );

        // ---------------------------------------------------------------
        // STAGE 3: Clear Blue Sky & Brand Centerpiece ENQUIVO (0.34 -> 0.68)
        // 1. Transition dark dusk sky into radiant clear blue sky.
        // 2. Introduce soft white clouds drifting behind typography.
        // 3. Move complete building visual away from central text area.
        // 4. Centerpiece giant image-clipped ENQUIVO with subtle inner parallax.
        // ---------------------------------------------------------------

        // Clear Blue Sky transition
        tl.to(
          blueSkyRef.current,
          {
            opacity: 1,
            duration: 0.14,
            ease: "power1.inOut",
          },
          0.34
        );

        // Soft white clouds fade in behind typography
        tl.to(
          stage3CloudsRef.current,
          {
            opacity: 0.90,
            y: 0,
            duration: 0.14,
            ease: "power1.out",
          },
          0.36
        );

        // Complete building cutout glides downward and smoothly disappears before middle of Stage 3 (completely gone by 0.44)
        tl.to(
          buildingCutoutRef.current,
          {
            y: "36vh",
            scale: 0.78,
            opacity: 0,
            duration: 0.12,
            ease: "power2.inOut",
          },
          0.32
        );

        // Primary brand centerpiece ENQUIVO emerges against blue sky and clouds
        tl.fromTo(
          projectIdentityRef.current,
          { opacity: 0, y: 30, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1.0,
            pointerEvents: "auto",
            duration: 0.12,
            ease: "power2.out",
          },
          0.38
        );

        // Subtle scroll-driven texture parallax inside the ENQUIVO clipped letters
        tl.to(
          typographyTitleRef.current,
          {
            backgroundPosition: "50% 68%",
            duration: 0.24,
            ease: "none",
          },
          0.40
        );

        // Soft background clouds drift gently across blue sky
        tl.to(
          stage3CloudsRef.current,
          {
            x: 50,
            duration: 0.24,
            ease: "none",
          },
          0.40
        );

        // ---------------------------------------------------------------
        // STAGE 4: Volumetric Cloud Immersion (0.54 -> 0.82)
        // 1. Foreground volumetric cloud curtain rises from 105vh to -4vh.
        // 2. Cloud layers physically rise over and envelop ENQUIVO.
        // 3. ENQUIVO remains visible until clouds naturally cover it.
        // 4. Porcelain veil fades in to transition atmosphere into #F7F8F4.
        // ---------------------------------------------------------------
        tl.fromTo(
          cloudWipeRef.current,
          { y: "105vh", opacity: 0 },
          {
            y: "-4vh",
            opacity: 1,
            duration: 0.24,
            ease: "power1.inOut",
          },
          0.54
        );

        // ENQUIVO dissolves gracefully only after clouds have physically covered it (0.66)
        tl.to(
          projectIdentityRef.current,
          {
            opacity: 0,
            scale: 1.03,
            pointerEvents: "none",
            duration: 0.08,
            ease: "power2.in",
          },
          0.66
        );

        // Atmospheric porcelain backdrop layer fades in behind clouds (0.66 -> 0.84)
        tl.fromTo(
          cloudVeilRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.18,
            ease: "power1.inOut",
          },
          0.66
        );

        // ---------------------------------------------------------------
        // STAGE 5: Cloud Blanket & High-Contrast Portfolio Reveal (0.76 -> 1.00)
        // Dense cloud curtain sweeps to full screen (y: -28vh).
        // Solid porcelain base merges with the #architecture section.
        // Portfolio Reveal emerges with high-contrast, crisp readable cards.
        // As scroll approaches 1.00, clouds dissolve progressively into next section.
        // ---------------------------------------------------------------
        tl.to(
          cloudWipeRef.current,
          {
            y: "-28vh",
            scale: 1.08,
            duration: 0.20,
            ease: "power2.out",
          },
          0.76
        );

        // Portfolio Reveal emerges through the cloud wipe
        tl.fromTo(
          portfolioRevealRef.current,
          { opacity: 0, y: 35, pointerEvents: "none" },
          {
            opacity: 1,
            y: 0,
            pointerEvents: "auto",
            duration: 0.16,
            ease: "power2.out",
          },
          0.80
        );

        // Progressive cloud dissipation as user scrolls toward unpin boundary
        tl.to(
          cloudWipeRef.current,
          {
            opacity: 0.35,
            duration: 0.10,
            ease: "power1.out",
          },
          0.90
        );
      });

      // =================================================================
      // MOBILE FALLBACK (< 768px or prefers-reduced-motion)
      // =================================================================
      mm.add("(max-width: 767px), (prefers-reduced-motion: reduce)", () => {
        if (containerRef.current) {
          containerRef.current.style.height = "auto";
          containerRef.current.style.minHeight = "auto";
        }
        if (buildingCutoutRef.current) {
          gsap.set(buildingCutoutRef.current, { x: "0%", y: "24vh", scale: 0.95, opacity: 0.75 });
        }
        if (headlineLayerRef.current) {
          gsap.set(headlineLayerRef.current, { opacity: 1, y: 0, pointerEvents: "auto" });
        }
        if (projectIdentityRef.current) {
          gsap.set(projectIdentityRef.current, { opacity: 0, display: "none" });
        }
        if (portfolioRevealRef.current) {
          gsap.set(portfolioRevealRef.current, { opacity: 0, display: "none", pointerEvents: "none" });
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: "350vh" }}
      className="relative w-full bg-[#071722] text-[#F7F8F4] overflow-x-hidden"
    >
      {/* Pinned Stage Viewport */}
      <div
        ref={stageRef}
        className="relative w-full h-[95vh] min-h-[660px] md:h-screen md:min-h-[720px] overflow-hidden flex items-center justify-center"
      >
        {/* =============================================================== */}
        {/* LAYER 1: Base Atmospheric Dusk Sky Gradient (z-index: 1)        */}
        {/* =============================================================== */}
        <div
          ref={skyRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071722] via-[#0B2231] to-[#102F43] z-[1]"
          aria-hidden="true"
        >
          {/* Subtle Ambient Golden Hour Horizon Glow */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#D6B56D]/15 via-[#13A99A]/10 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* =============================================================== */}
        {/* LAYER 1B: Luminous Clear Blue Sky Transition (z-index: 2)       */}
        {/* Transforms dusk atmosphere into clear sunlit sky for Stage 3    */}
        {/* =============================================================== */}
        <div
          ref={blueSkyRef}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#3B82B6] via-[#6CB4DE] to-[#D9EFF8] z-[2] will-change-transform hidden md:block"
          aria-hidden="true"
        >
          {/* Ambient Sunlight Diffusion (Pure CSS Radial Gradient, zero blur filter overhead) */}
          <div
            className="absolute -top-24 left-1/4 w-3/4 h-3/4 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, transparent 70%)",
            }}
            aria-hidden="true"
          />
        </div>

        {/* =============================================================== */}
        {/* LAYER 2: Distant Parallax Cloud Bank (z-index: 3)               */}
        {/* =============================================================== */}
        <div
          ref={cloud1Ref}
          className="pointer-events-none absolute -top-10 -left-16 w-[130%] h-[55%] opacity-55 mix-blend-screen will-change-transform z-[3]"
          aria-hidden="true"
        >
          <Image
            src="/images/hero-cloud-1.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <div
          ref={cloud2Ref}
          className="pointer-events-none absolute top-1/4 -right-20 w-[125%] h-[50%] opacity-45 mix-blend-screen will-change-transform z-[3]"
          aria-hidden="true"
        >
          <Image
            src="/images/hero-cloud-2.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {/* =============================================================== */}
        {/* LAYER 2B: Stage 3 Soft White Cloud Layer (z-index: 4)           */}
        {/* Billowing atmospheric white clouds floating behind ENQUIVO      */}
        {/* =============================================================== */}
        <div
          ref={stage3CloudsRef}
          style={{ opacity: 0, transform: "translate3d(0, 30px, 0)" }}
          className="pointer-events-none absolute inset-0 w-full h-full z-[4] will-change-transform hidden md:block"
          aria-hidden="true"
        >
          <div className="absolute top-[12%] -left-12 w-[85%] h-[50%] opacity-85">
            <Image
              src="/images/hero-cloud-1.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-contain object-left"
            />
          </div>
          <div className="absolute top-[28%] -right-16 w-[80%] h-[45%] opacity-75">
            <Image
              src="/images/hero-cloud-2.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-contain object-right"
            />
          </div>
        </div>

        {/* =============================================================== */}
        {/* LAYER 3: Headline Typography & Stage 1 Elements                 */}
        {/* Desktop: z-[10] (behind building z-[20] for physical occlusion) */}
        {/* Mobile: z-[25] (in front of building for clear touch/readability)*/}
        {/* =============================================================== */}
        <div
          ref={headlineLayerRef}
          className="relative z-[25] md:z-[10] mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full pt-12 md:pt-0 will-change-transform"
        >
          <div className="max-w-xl bg-[#071722]/80 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none p-6 md:p-0 rounded-3xl border border-white/10 md:border-none shadow-2xl md:shadow-none">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D6B56D]/40 bg-[#102F43]/90 px-4 py-1.5 text-xs font-semibold text-[#F7F8F4] shadow-lg backdrop-blur-md mb-5">
              <span className="flex h-2 w-2 rounded-full bg-[#13A99A] animate-pulse" />
              <span className="tracking-wide">Ahmedabad Prime Residential Corridors</span>
              <span className="text-[#D6B56D]">•</span>
              <span className="text-[11px] text-[#D6B56D] font-mono">SG Highway & Shela</span>
            </div>

            {/* Editorial Headline */}
            <h1 className="w-fit font-serif text-3xl sm:text-5xl lg:text-[4.2rem] font-normal tracking-tight text-white leading-[1.08] drop-shadow-md">
              A new perspective on <br />
              <span className="italic font-light text-[#D6B56D]">elevated living.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-5 text-sm sm:text-base leading-relaxed text-[#F7F8F4]/90 max-w-xl font-light">
              Curated {displayApartments} luxury residences across <strong>Prakriti Heights</strong> and <strong>Vaastu Enclave</strong>. Engineered with biophilic integrity, verified developer transparency, and instant 24/7 AI-assisted site-visit consultation.
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                href="/concierge"
                data-testid="hero-concierge-btn"
                className="flex h-12 sm:h-13 items-center justify-center gap-2.5 rounded-2xl bg-[#13A99A] px-7 text-sm font-semibold tracking-wide text-[#071722] shadow-xl transition-all hover:bg-[#D6B56D] hover:shadow-2xl hover:translate-y-[-1px] cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-[#071722]" />
                <span>Experience AI Concierge</span>
              </Link>

              <a
                href="#projects"
                onClick={(e) => handleScrollTo(e, "projects")}
                data-testid="hero-explore-developments-btn"
                className="flex h-12 sm:h-13 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-[#102F43]/85 px-6 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/20 hover:border-[#D6B56D]/60 cursor-pointer"
              >
                <span>Explore Developments</span>
                <ArrowDown className="h-4 w-4 text-[#D6B56D]" />
              </a>
            </div>

            {/* Verification Guarantee & Compliance Disclosures */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[#E7F4F4]/80">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#13A99A]" />
                AI Concierge Grounded in Verified Fact Sheets
              </span>
              <span className="text-white/30 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#13A99A]" />
                DPDP Act 2023 Digital Consent Enforced
              </span>
              <span className="text-white/30 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D6B56D]" />
                Direct Sales Executive Handoff
              </span>
            </div>

            {/* Metric Capsules Strip */}
            <div className="mt-5 inline-flex flex-wrap items-center gap-2.5 py-1.5 px-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md text-xs">
              <span className="font-semibold text-white">{displayApartments} Residences</span>
              <span className="text-white/30">|</span>
              <span className="font-semibold text-[#13A99A]">2 & 3 BHK</span>
              <span className="text-white/30">|</span>
              <span className="font-semibold text-[#D6B56D]">{priceRange}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/70">Ahmedabad</span>
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* LAYER 4: Foreground Architectural Tower Cutout (z-index: 20)    */}
        {/* Full-bleed compositing: zero max-w-5xl box, zero panel seams!   */}
        {/* All four outer canvas borders have alpha=0 for seamless blend.   */}
        {/* =============================================================== */}
        <div
          ref={buildingCutoutRef}
          style={{
            transform: "translate3d(36vw, 32vh, 0) scale(0.88)",
            transformOrigin: "center bottom",
          }}
          className="absolute inset-0 w-full h-full flex items-end justify-center pointer-events-none will-change-transform z-[20]"
          aria-label="Sculpted modern high-rise tower architectural illustrative concept"
        >
          <div className="relative w-full h-full min-h-[500px] pointer-events-none">
            <Image
              src="/images/hero-building-cutout.webp"
              alt="Sculpted modern high-rise tower architectural concept (illustrative)"
              fill
              priority
              quality={95}
              sizes="100vw"
              className="object-contain object-bottom"
            />
          </div>
        </div>

        {/* Illustrative Concept Badge - Anchored cleanly to Stage bottom-left */}
        <div className="absolute bottom-4 left-6 z-[22] hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#071722]/80 border border-white/10 text-[10px] text-white/60 backdrop-blur-md">
          <Info className="w-3 h-3 text-[#D6B56D]" />
          <span>Illustrative Architectural Concept • Not an Approved Developer Rendering</span>
        </div>

        {/* =============================================================== */}
        {/* LAYER 4B: Stage 3 Brand Signature Image-Clipped Typography (z-index: 26)*/}
        {/* Primary giant lettering: ENQUIVO (~70-75% viewport width)       */}
        {/* Below it: LUXURY RESIDENCES · AHMEDABAD                          */}
        {/* Supporting: PRAKRITI HEIGHTS · VAASTU ENCLAVE                    */}
        {/* =============================================================== */}
        <div
          ref={projectIdentityRef}
          style={{ opacity: 0, pointerEvents: "none" }}
          className="pointer-events-none absolute z-[26] inset-0 flex flex-col items-center justify-center px-4 sm:px-6 w-full text-center hidden md:flex will-change-transform"
          aria-label="ENQUIVO Luxury Residences Ahmedabad Brand Identity"
        >
          {/* Primary Oversized Architectural Image-Clipped Typography: ENQUIVO (~70-75% viewport span) */}
          <div className="relative w-full max-w-[1240px] mx-auto px-2 flex justify-center">
            <h2
              ref={typographyTitleRef}
              className="font-serif font-black tracking-tight leading-[0.86] uppercase select-none text-center whitespace-nowrap"
              style={{
                fontSize: "clamp(3.8rem, 14.8vw, 13.2rem)",
                letterSpacing: "-0.015em",
                backgroundImage:
                  "linear-gradient(rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08)), url('/images/hero-building-cinematic.webp')",
                backgroundSize: "cover",
                backgroundPosition: "50% 35%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                filter:
                  "drop-shadow(0 20px 40px rgba(16, 47, 67, 0.40)) drop-shadow(0 0 2px rgba(214, 181, 109, 0.75))",
                WebkitTextStroke: "1.5px rgba(214, 181, 109, 0.65)",
              }}
            >
              ENQUIVO
            </h2>
          </div>

          {/* Luxury Residences · Ahmedabad Subtitle */}
          <div className="mt-5 flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
            <div className="h-[1px] w-8 sm:w-16 bg-gradient-to-r from-transparent to-[#102F43]/40" />
            <span className="font-mono text-sm sm:text-base md:text-lg tracking-[0.35em] uppercase font-bold text-[#102F43] drop-shadow-sm">
              LUXURY RESIDENCES · AHMEDABAD
            </span>
            <div className="h-[1px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-[#102F43]/40" />
          </div>

          {/* Supporting Developments Line */}
          <div className="mt-3 flex items-center justify-center gap-3 text-xs sm:text-sm tracking-widest uppercase font-mono text-[#183442]/85">
            <span className="font-semibold text-[#13A99A]">PRAKRITI HEIGHTS</span>
            <span className="text-[#102F43]/40">·</span>
            <span className="font-semibold text-[#D6B56D]">VAASTU ENCLAVE</span>
          </div>

          {/* Discreet Conceptual Verification Disclaimer */}
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/60 border border-[#102F43]/10 text-[10px] text-[#183442]/70 backdrop-blur-md">
            <Info className="w-3 h-3 text-[#13A99A]" />
            <span>Illustrative Architectural Visualization • RERA Reg: DEMO-ONLY-NOT-VERIFIED</span>
          </div>
        </div>

        {/* =============================================================== */}
        {/* LAYER 4C: Atmospheric Porcelain Transition Layer (z-index: 28)  */}
        {/* Fades in behind clouds to turn dusk sky into porcelain #F7F8F4  */}
        {/* =============================================================== */}
        <div
          ref={cloudVeilRef}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 w-full h-full bg-[#F7F8F4] z-[28] will-change-transform hidden md:block"
          aria-hidden="true"
        />

        {/* =============================================================== */}
        {/* LAYER 5: Volumetric Foreground Cloud Curtain Wipe (z-index: 30) */}
        {/* Extended beyond all viewport edges (-inset-x-12 -bottom-24).     */}
        {/* Lower rows refined to 100% solid porcelain #F7F8F4 for seamless  */}
        {/* blend into the following #architecture section.                  */}
        {/* =============================================================== */}
        <div
          ref={cloudWipeRef}
          style={{ opacity: 0, transform: "translate3d(0, 105vh, 0)" }}
          className="pointer-events-none absolute -inset-x-12 -bottom-24 w-[calc(100%+6rem)] h-[155vh] z-[30] will-change-transform hidden md:block"
          aria-hidden="true"
        >
          <div className="relative w-full h-full">
            <Image
              src="/images/hero-cloud-wipe.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          </div>
        </div>

        {/* =============================================================== */}
        {/* LAYER 6: Stage 4 Portfolio Reveal (z-index: 40)                 */}
        {/* Sits cleanly on top of clouds with high-contrast, readable cards*/}
        {/* =============================================================== */}
        <div
          ref={portfolioRevealRef}
          style={{ opacity: 0, pointerEvents: "none" }}
          className="pointer-events-none absolute z-[40] mx-auto max-w-5xl px-4 sm:px-6 w-full text-center hidden md:block will-change-transform"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#102F43]/20 bg-[#102F43] px-4 py-1 text-xs font-semibold tracking-widest uppercase text-[#D6B56D] backdrop-blur-md mb-3 shadow-lg">
            <Building2 className="w-3.5 h-3.5 text-[#13A99A]" />
            <span>Ahmedabad Portfolio Reveal</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl font-normal text-[#102F43] tracking-tight drop-shadow-sm">
            Two Coveted Developments. <br />
            <span className="italic text-[#13A99A] font-light">One Uncompromising Standard.</span>
          </h2>

          {/* Twin Project Cards Preview (High Contrast, Clean Legibility) */}
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto text-left">
            {/* Project 1: Prakriti Heights */}
            <div className="p-7 rounded-3xl bg-white border border-[#102F43]/15 shadow-2xl relative group hover:border-[#13A99A]/60 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-[#102F43]/10">
                <span className="text-[11px] font-mono uppercase text-[#13A99A] font-semibold tracking-wider">
                  SG Highway Corridor
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#102F43]/10 text-[#102F43] font-medium">
                  210 Residences
                </span>
              </div>
              <h3 className="font-serif text-2xl font-normal text-[#102F43] mt-3">Prakriti Heights</h3>
              <p className="text-xs text-[#183442]/85 mt-1.5 leading-relaxed">
                High-rise panoramic living with biophilic stepped terraces, clubhouse, and infinity pool.
              </p>
              <div className="mt-4 pt-3 border-t border-[#102F43]/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#183442]/60 uppercase tracking-wider font-medium">Indicative Developer Pricing</div>
                  <div className="text-sm font-bold text-[#102F43]">From ₹65 Lakh*</div>
                </div>
                <a
                  href="#prakriti-heights"
                  onClick={(e) => handleScrollTo(e, "prakriti-heights")}
                  data-testid="hero-explore-prakriti-btn"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#13A99A] group-hover:translate-x-1 transition-transform cursor-pointer py-1.5 px-3 rounded-xl hover:bg-[#13A99A]/10"
                >
                  <span>Explore Project</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Project 2: Vaastu Enclave */}
            <div className="p-7 rounded-3xl bg-white border border-[#102F43]/15 shadow-2xl relative group hover:border-[#D6B56D]/60 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-[#102F43]/10">
                <span className="text-[11px] font-mono uppercase text-[#D6B56D] font-semibold tracking-wider">
                  Shela Prime Node
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#102F43]/10 text-[#102F43] font-medium">
                  210 Residences
                </span>
              </div>
              <h3 className="font-serif text-2xl font-normal text-[#102F43] mt-3">Vaastu Enclave</h3>
              <p className="text-xs text-[#183442]/85 mt-1.5 leading-relaxed">
                Vastu-aligned sanctuary residences centered around quiet garden courtyards and wellness amenities.
              </p>
              <div className="mt-4 pt-3 border-t border-[#102F43]/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#183442]/60 uppercase tracking-wider font-medium">Indicative Developer Pricing</div>
                  <div className="text-sm font-bold text-[#102F43]">Up to ₹1.2 Crore*</div>
                </div>
                <a
                  href="#vaastu-enclave"
                  onClick={(e) => handleScrollTo(e, "vaastu-enclave")}
                  data-testid="hero-explore-vaastu-btn"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#13A99A] group-hover:translate-x-1 transition-transform cursor-pointer py-1.5 px-3 rounded-xl hover:bg-[#13A99A]/10"
                >
                  <span>Explore Project</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Stage 4 Final Action Row */}
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/concierge"
              data-testid="hero-concierge-stage4-btn"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#102F43] px-7 text-sm font-semibold tracking-wide text-[#F7F8F4] shadow-xl hover:bg-[#13A99A] transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-[#D6B56D]" />
              <span>Meet AI Concierge</span>
            </Link>
            <a
              href="#architecture"
              onClick={(e) => handleScrollTo(e, "architecture")}
              data-testid="hero-explore-architecture-btn"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#102F43]/30 bg-white/90 px-6 text-sm font-semibold text-[#102F43] shadow-md hover:bg-white transition-colors cursor-pointer"
            >
              <span>Explore 3D Architecture Study</span>
              <ArrowDown className="h-4 w-4 text-[#13A99A]" />
            </a>
          </div>

          {/* Compliance & Indicative Pricing Disclaimers */}
          <div className="mt-5 space-y-1 text-[11px] text-[#183442]/70 font-medium">
            <div>
              *Indicative developer price range based on verified portfolio fact sheet. Final unit pricing subject to inventory and floor selection.
            </div>
            <div>
              RERA Reg: DEMO-ONLY-NOT-VERIFIED • Indicative architectural study • AI concierge grounded strictly in developer-verified fact sheet.
            </div>
          </div>
        </div>

        {/* =============================================================== */}
        {/* LAYER 7: 5-Stage Interactive Progress Indicator (z-index: 50)    */}
        {/* Pure DOM refs — zero React state updates, accessible navigation */}
        {/* =============================================================== */}
        <nav
          className="absolute right-6 top-1/2 -translate-y-1/2 z-[50] hidden lg:flex flex-col items-end gap-3 select-none"
          aria-label="Cinematic sequence navigation"
        >
          <button
            ref={step1Ref}
            type="button"
            data-active="true"
            aria-current="step"
            onClick={() => handleJumpToStep(1)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleJumpToStep(1)}
            aria-label="Jump to Stage 1: Perspective"
            className="flex items-center gap-2.5 transition-all duration-300 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13A99A] rounded-lg px-2 py-1"
          >
            <span
              data-step-label
              className="text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 text-[#D6B56D] font-bold group-hover:text-white"
            >
              Perspective
            </span>
            <span data-step-bar className="h-2 rounded-full transition-all duration-300 w-6 bg-[#13A99A] group-hover:bg-[#13A99A]" />
          </button>

          <button
            ref={step2Ref}
            type="button"
            data-active="false"
            onClick={() => handleJumpToStep(2)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleJumpToStep(2)}
            aria-label="Jump to Stage 2: Architecture Rise"
            className="flex items-center gap-2.5 transition-all duration-300 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13A99A] rounded-lg px-2 py-1"
          >
            <span
              data-step-label
              className="text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 text-white/40 group-hover:text-white"
            >
              Architecture Rise
            </span>
            <span data-step-bar className="h-2 rounded-full transition-all duration-300 w-2 bg-white/20 group-hover:bg-white/40" />
          </button>

          <button
            ref={step3Ref}
            type="button"
            data-active="false"
            onClick={() => handleJumpToStep(3)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleJumpToStep(3)}
            aria-label="Jump to Stage 3: Project Identity"
            className="flex items-center gap-2.5 transition-all duration-300 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13A99A] rounded-lg px-2 py-1"
          >
            <span
              data-step-label
              className="text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 text-white/40 group-hover:text-white"
            >
              Project Identity
            </span>
            <span data-step-bar className="h-2 rounded-full transition-all duration-300 w-2 bg-white/20 group-hover:bg-white/40" />
          </button>

          <button
            ref={step4Ref}
            type="button"
            data-active="false"
            onClick={() => handleJumpToStep(4)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleJumpToStep(4)}
            aria-label="Jump to Stage 4: Cloud Immersion"
            className="flex items-center gap-2.5 transition-all duration-300 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13A99A] rounded-lg px-2 py-1"
          >
            <span
              data-step-label
              className="text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 text-white/40 group-hover:text-white"
            >
              Cloud Immersion
            </span>
            <span data-step-bar className="h-2 rounded-full transition-all duration-300 w-2 bg-white/20 group-hover:bg-white/40" />
          </button>

          <button
            ref={step5Ref}
            type="button"
            data-active="false"
            onClick={() => handleJumpToStep(5)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleJumpToStep(5)}
            aria-label="Jump to Stage 5: Portfolio"
            className="flex items-center gap-2.5 transition-all duration-300 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13A99A] rounded-lg px-2 py-1"
          >
            <span
              data-step-label
              className="text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 text-white/40 group-hover:text-white"
            >
              Portfolio
            </span>
            <span data-step-bar className="h-2 rounded-full transition-all duration-300 w-2 bg-white/20 group-hover:bg-white/40" />
          </button>
        </nav>

        {/* Scroll Invitation Indicator (Stage 1 only, desktop only) */}
        <div
          ref={scrollIndicatorRef}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[25] hidden md:flex flex-col items-center gap-1.5 pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#E7F4F4]/75">
            Scroll to explore architectural details
          </span>
          <ChevronDown className="w-4 h-4 text-[#D6B56D] animate-bounce" />
        </div>
      </div>

      {/* Bottom seamless transition bridge to #architecture (matches porcelain #F7F8F4 identically) */}
      <div
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-[#F7F8F4]/80 to-[#F7F8F4] pointer-events-none z-[1] hidden md:block"
        aria-hidden="true"
      />
    </div>
  );
}
