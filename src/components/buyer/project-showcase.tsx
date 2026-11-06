import Link from "next/link";
import { Building, MapPin, Layers, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

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
  return (
    <section id="projects" className="py-20 sm:py-28 bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-12 border-b border-stone-200 dark:border-stone-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Current Developments
            </span>
            <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight text-stone-950 dark:text-stone-50 sm:text-4xl">
              Signature Ahmedabad Residences
            </h2>
          </div>
          <p className="max-w-md text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            All details reflect verified database records for our two active developments in Ahmedabad. Verified pricing ranges from ₹65 lakh to ₹1.2 crore.
          </p>
        </div>

        {/* Project Cards Grid */}
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/50 shadow-xs transition-all hover:border-stone-300 hover:shadow-md dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-stone-700"
            >
              {/* Project Architectural Presentation Block */}
              <div className="relative h-64 sm:h-72 w-full bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 p-8 flex flex-col justify-between overflow-hidden text-stone-100">
                {/* Background Blueprint Grid Geometry */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                    backgroundSize: "28px 28px",
                  }}
                  aria-hidden="true"
                />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-stone-200 backdrop-blur-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Active Development
                  </span>
                  <span className="text-xs font-mono tracking-wider text-stone-400">
                    {project.name.toUpperCase().replace(/\s+/g, "-")}
                  </span>
                </div>

                <div className="relative z-10">
                  <span className="text-xs uppercase tracking-widest text-amber-300 font-medium">
                    Ahmedabad, Gujarat
                  </span>
                  <h3 className="font-serif text-3xl font-medium tracking-wide text-white mt-1">
                    {project.name}
                  </h3>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-stone-300">
                    <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{project.location}</span>
                  </div>
                </div>
              </div>

              {/* Project Body & Verified Attributes */}
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  {/* Verified Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 pb-6 border-b border-stone-200/80 dark:border-stone-800">
                    <div className="rounded-xl border border-stone-200/80 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
                      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                        <Building className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">
                          Total Inventory
                        </span>
                      </div>
                      <p className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-50">
                        {project.totalUnits} Units
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        210 units in phase
                      </p>
                    </div>

                    <div className="rounded-xl border border-stone-200/80 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
                      <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                        <Layers className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">
                          Configurations
                        </span>
                      </div>
                      <p className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-50">
                        2 & 3 BHK
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Verified spatial layout
                      </p>
                    </div>
                  </div>

                  {/* Fact Sheet Grounded Statements */}
                  <div className="py-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-stone-200/60 p-1 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        <strong className="font-semibold text-stone-900 dark:text-stone-100">Configurations:</strong> {configurationsFact}
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-stone-200/60 p-1 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        <strong className="font-semibold text-stone-900 dark:text-stone-100">Portfolio Pricing:</strong> {priceRangeFact}
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-stone-200/60 p-1 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                        <ShieldCheck className="h-3.5 w-3.5 text-stone-500" />
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                        <strong className="font-medium text-stone-700 dark:text-stone-300">RERA Registration:</strong> {project.reraNumber} (Demo placeholder).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action Link */}
                <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800">
                  <Link
                    href="#concierge"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50 transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                  >
                    <Sparkles className="h-4 w-4 text-amber-400 dark:text-amber-600" />
                    <span>Enquire for {project.name}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
