import Link from "next/link";
import { ArrowDown, Sparkles } from "lucide-react";

interface HeroSectionProps {
  totalApartments?: string;
  priceRange?: string;
}

export function HeroSection({
  totalApartments = "420",
  priceRange = "₹65L – ₹1.2Cr",
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden border-b border-stone-200/80 bg-stone-50/60 pt-16 pb-20 dark:border-stone-800 dark:bg-stone-900/40 sm:pt-24 sm:pb-28">
      {/* Background Architectural Accent Lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(#1c1917 1px, transparent 1px), radial-gradient(#1c1917 1px, #f5f5f4 1px)`,
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Subtle Tagline Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/80 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-800 shadow-xs dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span>Ahmedabad West Prime Growth Corridors</span>
          </div>

          {/* Editorial Headline */}
          <h1 className="font-serif text-4xl font-normal tracking-tight text-stone-950 sm:text-6xl sm:leading-[1.15] dark:text-stone-50">
            Thoughtful living in Ahmedabad’s premier destinations.
          </h1>

          {/* Refined Supporting Copy */}
          <p className="mt-6 text-lg leading-8 text-stone-600 dark:text-stone-300 sm:text-xl">
            Introducing 420 premium 2 & 3 BHK residences across SG Highway and Shela. Designed with architectural integrity, transparent pricing, and instant AI-assisted booking.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="#projects"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-7 text-sm font-semibold tracking-wide text-stone-50 shadow-sm transition-all hover:bg-stone-800 hover:shadow-md dark:bg-stone-50 dark:text-stone-950 dark:hover:bg-stone-200 sm:w-auto"
            >
              <span>Explore Developments</span>
              <ArrowDown className="h-4 w-4" />
            </Link>

            <Link
              href="#concierge"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-7 text-sm font-semibold text-stone-800 shadow-xs transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800 sm:w-auto"
            >
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>AI Site-Visit Assistant</span>
            </Link>
          </div>
        </div>

        {/* Verified Portfolio Highlights Strip */}
        <div className="mt-16 sm:mt-24">
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-950 sm:grid-cols-4 sm:gap-8 sm:p-8">
            <div className="flex flex-col border-r border-stone-100 last:border-r-0 dark:border-stone-800/80 pr-4">
              <span className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50 sm:text-3xl">
                2
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Live Projects
              </span>
              <span className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                SG Highway & Shela
              </span>
            </div>

            <div className="flex flex-col border-r border-stone-100 last:border-r-0 dark:border-stone-800/80 pr-4">
              <span className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50 sm:text-3xl">
                {totalApartments}
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Total Apartments
              </span>
              <span className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                210 Units Per Project
              </span>
            </div>

            <div className="flex flex-col border-r border-stone-100 last:border-r-0 dark:border-stone-800/80 pr-4">
              <span className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50 sm:text-3xl">
                2 & 3 BHK
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Configurations
              </span>
              <span className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                Optimal Spatial Flow
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50 sm:text-3xl">
                {priceRange}
              </span>
              <span className="mt-1 text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Verified Pricing
              </span>
              <span className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                Transparent Range
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
