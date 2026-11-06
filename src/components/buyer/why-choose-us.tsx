import { MapPin, Building2, Sliders, ShieldCheck } from "lucide-react";

export function WhyChooseUs() {
  const pillars = [
    {
      icon: MapPin,
      title: "Strategic Growth Corridors",
      description:
        "Located in Ahmedabad's most dynamic western growth sectors — SG Highway and Shela — providing direct transit connectivity to major commercial, healthcare, and educational hubs.",
    },
    {
      icon: Building2,
      title: "Planned 420-Unit Community Scale",
      description:
        "Exactly 420 premium apartments across both developments (210 units each), engineered to balance spacious residential privacy with community amenities.",
    },
    {
      icon: Sliders,
      title: "Dedicated 2 & 3 BHK Layouts",
      description:
        "Both developments exclusively feature 2 BHK and 3 BHK configurations, designed for optimal cross-ventilation, ample daylight, and modern lifestyle ergonomics.",
    },
    {
      icon: ShieldCheck,
      title: "Direct & Transparent Pricing",
      description:
        "Verified developer pricing strictly within the ₹65 lakh to ₹1.2 crore range across both projects, ensuring clear financial visibility without unverified price escalations.",
    },
  ];

  return (
    <section id="about" className="py-20 sm:py-28 bg-stone-50/70 border-y border-stone-200/80 dark:bg-stone-900/30 dark:border-stone-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Portfolio Principles
          </span>
          <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight text-stone-950 dark:text-stone-50 sm:text-4xl">
            Why Choose an ENQUIVO Residence
          </h2>
          <p className="mt-4 text-base text-stone-600 dark:text-stone-300">
            Every specification is grounded directly in verified project data. We commit to complete transparency without unverified claims or speculative promises.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-7 shadow-2xs transition-shadow hover:shadow-sm dark:border-stone-800 dark:bg-stone-950"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100">
                    <Icon className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-stone-950 dark:text-stone-50">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
