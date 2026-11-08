import Link from "next/link";
import { Building, MapPin, Layers, ShieldCheck, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

export interface ProjectDisplayData {
  id: string;
  name: string;
  location: string;
  totalUnits: number;
  reraNumber: string;
}

interface ProjectShowcaseProps {
  projects: ProjectDisplayData[];
  configurationsFact?: string;
  priceRangeFact?: string;
}

export function ProjectShowcase({
  projects,
  configurationsFact = "2 BHK and 3 BHK luxury configurations available across both projects.",
  priceRangeFact = "₹65 lakh to ₹1.2 crore across both projects in Ahmedabad.",
}: ProjectShowcaseProps) {
  // Rich architectural metadata for each verified development
  const projectMeta: Record<
    string,
    {
      corridor: string;
      tagline: string;
      config: string;
      pricing: string;
      accentColor: string;
      highlights: string[];
      heroGradient: string;
    }
  > = {
    "Prakriti Heights": {
      corridor: "SG Highway Corridor, Ahmedabad",
      tagline: "High-Rise Panoramic Living with Biophilic Facades",
      config: "3 BHK Luxury Residences",
      pricing: "₹95 Lakh – ₹1.2 Crore",
      accentColor: "#13A99A",
      highlights: [
        "Panoramic Ahmedabad skyline views",
        "Stepped sky-gardens & expansive balconies",
        "Direct SG Highway connectivity & business access",
        "210 premium residences in master phase",
      ],
      heroGradient: "from-[#102F43] via-[#183442] to-[#0B2231]",
    },
    "Vaastu Enclave": {
      corridor: "Shela Residential Growth Corridor, Ahmedabad",
      tagline: "Serene Vastu-Compliant Architecture & Green Courtyards",
      config: "2 & 3 BHK Contemporary Residences",
      pricing: "₹65 Lakh – ₹98 Lakh",
      accentColor: "#D6B56D",
      highlights: [
        "Traditional Vastu orientation with modern ergonomics",
        "Central pedestrianized landscape courtyard & lap pool",
        "Rapid access to Club 07 and South Bopal hubs",
        "210 residences designed for modern families",
      ],
      heroGradient: "from-[#183442] via-[#102F43] to-[#0D7A6F]/80",
    },
  };

  return (
    <section id="projects" className="py-20 sm:py-28 bg-[#F7F8F4] border-b border-[#102F43]/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-12 border-b border-[#102F43]/10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#13A99A]">
              Ahmedabad Residential Portfolio
            </span>
            <h2 className="mt-2 font-serif text-3xl sm:text-5xl font-normal tracking-tight text-[#102F43]">
              Signature Developments
            </h2>
          </div>
          <p className="max-w-md text-sm text-[#183442]/80 leading-relaxed">
            All details reflect verified database records for our two active developments in Ahmedabad. Featuring {configurationsFact} with verified portfolio pricing of {priceRangeFact}.
          </p>
        </div>

        {/* Project Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {projects.map((project) => {
            const meta = projectMeta[project.name] || {
              corridor: project.location,
              tagline: "Contemporary Residential Development",
              config: "2 & 3 BHK Residences",
              pricing: "₹65 Lakh – ₹1.2 Crore",
              accentColor: "#13A99A",
              highlights: [
                "210 units in master development phase",
                "Ahmedabad prime growth corridor location",
                "Verified developer pricing transparency",
              ],
              heroGradient: "from-[#102F43] via-[#183442] to-[#0B2231]",
            };

            return (
              <article
                key={project.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[#102F43]/10 bg-white shadow-sm transition-all hover:border-[#13A99A]/50 hover:shadow-xl"
              >
                {/* Architectural Presentation Header */}
                <div
                  className={`relative h-72 sm:h-80 w-full bg-gradient-to-br ${meta.heroGradient} p-8 flex flex-col justify-between overflow-hidden text-[#F7F8F4]`}
                >
                  {/* Subtle Blueprint Grid Background */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                      backgroundSize: "28px 28px",
                    }}
                    aria-hidden="true"
                  />

                  {/* Top Badges */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium text-[#F7F8F4] backdrop-blur-md border border-white/10">
                      <span className="h-2 w-2 rounded-full bg-[#13A99A] animate-pulse" />
                      Active Development
                    </span>
                    <span className="text-[11px] font-mono tracking-wider text-[#D6B56D] uppercase">
                      {project.name.toUpperCase().replace(/\s+/g, "-")}
                    </span>
                  </div>

                  {/* Middle Title & Corridor */}
                  <div className="relative z-10">
                    <span className="text-xs uppercase tracking-widest text-[#D6B56D] font-semibold">
                      {meta.corridor}
                    </span>
                    <h3 className="font-serif text-3xl sm:text-4xl font-normal tracking-wide text-white mt-1">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#E7F4F4]/80 italic">
                      {meta.tagline}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-white/90">
                      <MapPin className="h-4 w-4 text-[#13A99A] shrink-0" />
                      <span>{project.location}</span>
                    </div>
                  </div>

                  {/* Illustrative Architectural Visual Notice */}
                  <div className="relative z-10 text-[9px] uppercase tracking-wider text-white/60">
                    Illustrative Architectural Concept • Representative Imagery
                  </div>
                </div>

                {/* Project Body & Verified Attributes */}
                <div className="flex flex-1 flex-col justify-between p-6 sm:p-8 space-y-6">
                  {/* Verified Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 pb-6 border-b border-[#102F43]/10">
                    <div className="rounded-2xl border border-[#102F43]/10 bg-[#F7F8F4] p-4">
                      <div className="flex items-center gap-2 text-[#183442]/70">
                        <Building className="h-4 w-4 text-[#13A99A]" />
                        <span className="text-xs uppercase tracking-wider font-semibold">
                          Total Inventory
                        </span>
                      </div>
                      <p className="mt-1 text-xl font-bold text-[#102F43]">
                        {project.totalUnits} Units
                      </p>
                      <p className="text-[11px] text-[#183442]/70">
                        210 units in phase
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#102F43]/10 bg-[#F7F8F4] p-4">
                      <div className="flex items-center gap-2 text-[#183442]/70">
                        <Layers className="h-4 w-4 text-[#D6B56D]" />
                        <span className="text-xs uppercase tracking-wider font-semibold">
                          Configuration
                        </span>
                      </div>
                      <p className="mt-1 text-xl font-bold text-[#102F43]">
                        {meta.config.split(" ")[0]} BHK
                      </p>
                      <p className="text-[11px] text-[#183442]/70">
                        {meta.config}
                      </p>
                    </div>
                  </div>

                  {/* Key Highlights */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#102F43] mb-3">
                      Development Highlights
                    </h4>
                    <ul className="space-y-2.5">
                      {meta.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-[#183442]/85">
                          <CheckCircle2 className="h-4 w-4 text-[#13A99A] shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* RERA Statutory Compliance Disclaimer */}
                  <div className="rounded-xl bg-[#E7F4F4]/50 border border-[#102F43]/10 p-3.5 flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-[#102F43] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-[#183442] leading-relaxed">
                      <strong className="text-[#102F43]">Regulatory Registration:</strong>{" "}
                      <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#102F43]/10 text-[#102F43] font-bold">
                        {project.reraNumber}
                      </code>{" "}
                      — Verified technical evaluation data.
                    </div>
                  </div>

                  {/* Interactive Action Links */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <Link
                      href={`/concierge?project=${project.id}`}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#102F43] text-xs font-semibold tracking-wide text-[#F7F8F4] shadow-sm transition-all hover:bg-[#13A99A]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#D6B56D]" />
                      <span>Consult AI Regarding {project.name.split(" ")[0]}</span>
                    </Link>

                    <Link
                      href="/concierge"
                      className="flex h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[#102F43]/20 bg-white px-5 text-xs font-semibold text-[#102F43] hover:bg-[#E7F4F4]"
                    >
                      <span>Book Visit</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#13A99A]" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
