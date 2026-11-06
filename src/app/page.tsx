import { prisma } from "@/lib/prisma";
import { FactSheetScope, FactSheetStatus } from "@prisma/client";
import { PublicNav } from "@/components/buyer/public-nav";
import { HeroSection } from "@/components/buyer/hero-section";
import { ProjectShowcase } from "@/components/buyer/project-showcase";
import { WhyChooseUs } from "@/components/buyer/why-choose-us";
import { ConciergeCtaSection } from "@/components/buyer/concierge-cta-section";
import { PublicFooter } from "@/components/buyer/public-footer";

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

  const totalApartmentsFact = factsMap["total_apartments"] || "420 apartments total";
  const configurationsFact = factsMap["configurations"] || "2 BHK and 3 BHK luxury configurations";
  const priceRangeFact = factsMap["price_range"] || "₹65 lakh to ₹1.2 crore";

  return (
    <div className="min-h-screen flex flex-col bg-white text-stone-900 dark:bg-stone-950 dark:text-stone-50 font-sans selection:bg-amber-100 selection:text-amber-900">
      <PublicNav />
      <main className="flex-1">
        <HeroSection
          totalApartments={totalApartmentsFact}
          priceRange="₹65L – ₹1.2Cr"
        />
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
