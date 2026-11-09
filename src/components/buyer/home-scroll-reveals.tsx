"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Restrained scroll-triggered reveals for below-the-hero homepage sections.
 * Features:
 * - Subtle fade and upward movement (y: 24 -> 0)
 * - Staggered card groups
 * - once: true (no jank on reverse scrolling)
 * - prefers-reduced-motion respected
 * - Zero pinning, zero competition with hero timeline
 */
export function HomeScrollReveals() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // 1. Reveal for #architecture study
      const archSection = document.getElementById("architecture");
      if (archSection) {
        const archHeader = archSection.querySelector("[data-reveal-header]");
        const archContent = archSection.querySelector("[data-reveal-content]");
        if (archHeader) {
          gsap.fromTo(
            archHeader,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              duration: 0.65,
              ease: "power2.out",
              scrollTrigger: {
                trigger: archHeader,
                start: "top 85%",
                once: true,
              },
            }
          );
        }
        if (archContent) {
          gsap.fromTo(
            archContent,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: "power2.out",
              scrollTrigger: {
                trigger: archContent,
                start: "top 80%",
                once: true,
              },
            }
          );
        }
      }

      // 2. Staggered reveal for #projects cards
      const projectsSection = document.getElementById("projects");
      if (projectsSection) {
        const projectCards = projectsSection.querySelectorAll("article");
        if (projectCards.length > 0) {
          gsap.fromTo(
            projectCards,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              stagger: 0.16,
              ease: "power2.out",
              scrollTrigger: {
                trigger: projectsSection,
                start: "top 78%",
                once: true,
              },
            }
          );
        }
      }

      // 3. Staggered reveal for #standards cards
      const standardsSection = document.getElementById("standards");
      if (standardsSection) {
        const standardCards = standardsSection.querySelectorAll("[data-standard-card]");
        if (standardCards.length > 0) {
          gsap.fromTo(
            standardCards,
            { opacity: 0, y: 22 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              stagger: 0.1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: standardsSection,
                start: "top 80%",
                once: true,
              },
            }
          );
        }
      }
    });

    return () => ctx.revert();
  }, []);

  return null;
}
