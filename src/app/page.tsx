import { prisma } from "@/lib/prisma";
import { FactSheetScope, FactSheetStatus } from "@prisma/client";
import { PublicNav } from "@/components/buyer/public-nav";
import { HeroSection } from "@/components/buyer/hero-section";
import { ProjectShowcase } from "@/components/buyer/project-showcase";
import { ArchitecturalScene3D } from "@/components/buyer/architectural-scene-3d";
import { WhyChooseUs } from "@/components/buyer/why-choose-us";
import { ConciergeCtaSection } from "@/components/buyer/concierge-cta-section";
import { PublicFooter } from "@/components/buyer/public-footer";
import { Compass } from "lucide-react";

export const instant = false;

export default async function HomePage() {
  // Fetch only public project display data from PostgreSQL
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      location: true,
      totalUnits: true,
      reraNumber: true,
    },
  });

  // Fetch only active, verified portfolio-scope facts
  const verifiedFacts = await prisma.factSheet.findMany({
    where: {
      status: FactSheetStatus.VERIFIED,
      isActive: true,
      scope: FactSheetScope.PORTFOLIO,
    },
    select: {
      key: true,
      value: true,
    },
  });

  // Map facts dictionary
  const factsMap: Record<string, string> = {};
  for (const f of verifiedFacts) {
    factsMap[f.key] = f.value;
  }

  // Derive concise unit count from project aggregate or fact string (e.g. "420")
  const totalApartmentsCount =
    projects.length > 0
      ? projects.reduce((acc, p) => acc + p.totalUnits, 0).toString()
      : (factsMap["total_apartments"]?.match(/\d+/)?.[0] || "420");

  const configurationsFact = factsMap["configurations"] || "2 BHK and 3 BHK luxury configurations";
  const priceRangeFact = factsMap["price_range"] || "₹65 lakh to ₹1.2 crore";

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F4] text-[#102F43] font-sans selection:bg-[#13A99A]/20 selection:text-[#102F43]">
      <PublicNav />
      <main className="flex-1">
        <HeroSection
          totalApartments={totalApartmentsCount}
          priceRange="₹65L – ₹1.2Cr"
        />

        {/* Signature 3D Architectural Scene Section */}
        <section id="architecture" className="py-20 sm:py-28 bg-white border-b border-[#102F43]/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-10 border-b border-[#102F43]/10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E7F4F4] text-[#13A99A] text-xs font-semibold uppercase tracking-wider mb-2">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Spatial Architecture</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-[#102F43]">
                  Interactive 3D Architectural Study
                </h2>
              </div>
              <p className="max-w-md text-sm text-[#183442]/80 leading-relaxed">
                Explore the conceptual massing of our twin Ahmedabad developments: the stepped panoramic high-rise profile of <strong>Prakriti Heights</strong> and the green biophilic courtyard layout of <strong>Vaastu Enclave</strong>.
              </p>
            </div>

            <div className="mt-10">
              <ArchitecturalScene3D />
            </div>
          </div>
        </section>

        <ProjectShowcase
          projects={projects}
          configurationsFact={configurationsFact}
          priceRangeFact={priceRangeFact}
        />
        <WhyChooseUs />
        <ConciergeCtaSection />
      </main>
      <PublicFooter />
    </div>
  );
}
