import Link from "next/link";
import { ArrowDown, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";

interface HeroSectionProps {
  totalApartments?: string;
  priceRange?: string;
}

export function HeroSection({
  totalApartments = "420",
  priceRange = "₹65L – ₹1.2Cr",
}: HeroSectionProps) {
  const displayApartments = totalApartments.match(/^\d+/)?.[0] || totalApartments;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F7F8F4] via-[#E7F4F4]/30 to-[#F7F8F4] pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-[#102F43]/10">
      {/* Background Architectural Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(#102F43 1.5px, transparent 1.5px), radial-gradient(#102F43 1.5px, #F7F8F4 1.5px)`,
          backgroundSize: "44px 44px",
          backgroundPosition: "0 0, 22px 22px",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Editorial Headline & Actions */}
          <div className="lg:col-span-7 text-left">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#13A99A]/30 bg-white/80 px-4 py-1.5 text-xs font-semibold text-[#102F43] shadow-xs backdrop-blur-md mb-6">
              <span className="flex h-2 w-2 rounded-full bg-[#13A99A] animate-pulse" />
              <span>Ahmedabad Prime Residential Corridors</span>
              <span className="text-[#D6B56D]">•</span>
              <span className="text-[11px] text-[#183442]/70 font-mono">SG Highway & Shela</span>
            </div>

            {/* Editorial Headline */}
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-[4.2rem] font-normal tracking-tight text-[#102F43] leading-[1.12]">
              Sculpted living in <br />
              <span className="italic font-light text-[#13A99A]">Ahmedabad’s</span> finest <br />
              destinations.
            </h1>

            {/* Supporting Copy */}
            <p className="mt-6 text-base sm:text-lg leading-relaxed text-[#183442]/80 max-w-2xl">
              Discover 420 luxury 2 & 3 BHK residences across <strong>Prakriti Heights</strong> and <strong>Vaastu Enclave</strong>. Engineered with biophilic integrity, verified developer transparency, and instant 24/7 AI-assisted site-visit consultation.
            </p>

            {/* Action CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/concierge"
                className="flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-[#102F43] px-8 text-sm font-semibold tracking-wide text-[#F7F8F4] shadow-lg transition-all hover:bg-[#13A99A] hover:shadow-xl hover:translate-y-[-1px]"
              >
                <Sparkles className="h-4 w-4 text-[#D6B56D]" />
                <span>Experience AI Concierge</span>
              </Link>

              <Link
                href="#projects"
                className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-[#102F43]/20 bg-white/90 px-7 text-sm font-semibold text-[#102F43] shadow-xs transition-all hover:bg-[#E7F4F4] hover:border-[#13A99A]/50"
              >
                <span>Explore Developments</span>
                <ArrowDown className="h-4 w-4 text-[#13A99A]" />
              </Link>
            </div>

            {/* Verification Guarantee Micro-strip */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-[11px] text-[#183442]/75">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#13A99A]" />
                100% Grounded in Developer Facts
              </span>
              <span className="text-[#102F43]/20">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#13A99A]" />
                DPDP Act 2023 Digital Consent Enforced
              </span>
              <span className="text-[#102F43]/20">•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D6B56D]" />
                Direct Sales Executive Handoff
              </span>
            </div>
          </div>

          {/* Right Column: Signature Architectural Presentation Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden bg-[#102F43] border border-[#102F43]/20 shadow-2xl p-6 text-[#F7F8F4]">
              {/* Architectural Ambient Gradient */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#0B2231] via-[#102F43] to-[#183442] opacity-95" />

              {/* Subtle Decorative Geometry */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `linear-gradient(to right, #D6B56D 1px, transparent 1px), linear-gradient(to bottom, #D6B56D 1px, transparent 1px)`,
                  backgroundSize: "32px 32px",
                }}
              />

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#13A99A] animate-ping" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#D6B56D]">
                      Ahmedabad Portfolio
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                    420 Residences
                  </span>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-widest text-[#E7F4F4]/70 font-medium">
                    Twin Developments
                  </span>
                  <h3 className="font-serif text-2xl font-normal text-white mt-1">
                    Prakriti Heights & Vaastu Enclave
                  </h3>
                  <p className="mt-2 text-xs text-[#E7F4F4]/80 leading-relaxed">
                    Designed for panoramic city views along SG Highway and serene vastu harmony in Shela, Ahmedabad.
                  </p>
                </div>

                {/* Metric Grid inside Card */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[10px] uppercase font-semibold text-[#D6B56D]">Price Range</div>
                    <div className="text-lg font-bold text-white mt-0.5">{priceRange}</div>
                    <div className="text-[10px] text-white/60">Verified developer pricing</div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[10px] uppercase font-semibold text-[#13A99A]">Configurations</div>
                    <div className="text-lg font-bold text-white mt-0.5">2 & 3 BHK</div>
                    <div className="text-[10px] text-white/60">Luxury apartment layouts</div>
                  </div>
                </div>

                {/* Illustrative Notice */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[10px] text-white/70 leading-relaxed">
                  <strong className="text-[#D6B56D]">Evaluation Notice:</strong> Specifications reflect verified assessment records for two projects in Ahmedabad. RERA Reg: DEMO-ONLY-NOT-VERIFIED.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verified Portfolio Highlights Strip */}
        <div className="mt-16 sm:mt-24">
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-[#102F43]/10 bg-white p-6 shadow-sm sm:grid-cols-4 sm:gap-8 sm:p-8">
            <div className="flex flex-col border-r border-[#102F43]/10 pr-4 last:border-r-0">
              <span className="text-3xl font-serif font-bold tracking-tight text-[#102F43] sm:text-4xl">
                2
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#13A99A]">
                Live Developments
              </span>
              <span className="mt-0.5 text-xs text-[#183442]/70">
                SG Highway & Shela Corridors
              </span>
            </div>

            <div className="flex flex-col border-r border-[#102F43]/10 pr-4 last:border-r-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r">
              <span className="text-3xl font-serif font-bold tracking-tight text-[#102F43] sm:text-4xl">
                {displayApartments}
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#13A99A]">
                Total Apartments
              </span>
              <span className="mt-0.5 text-xs text-[#183442]/70">
                210 Units Per Project
              </span>
            </div>

            <div className="flex flex-col border-r border-[#102F43]/10 pr-4 last:border-r-0">
              <span className="text-3xl font-serif font-bold tracking-tight text-[#102F43] sm:text-4xl">
                2 & 3 BHK
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#13A99A]">
                Configurations
              </span>
              <span className="mt-0.5 text-xs text-[#183442]/70">
                Curated Luxury Living
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-3xl font-serif font-bold tracking-tight text-[#102F43] sm:text-4xl">
                {priceRange}
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#13A99A]">
                Developer Pricing
              </span>
              <span className="mt-0.5 text-xs text-[#183442]/70">
                Transparent & Verified
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
