import Link from "next/link";
import { ArrowLeft, Sparkles, Building2 } from "lucide-react";
import { ConciergeChat } from "@/components/buyer/concierge-chat";

export const metadata = {
  title: "AI Concierge — ENQUIVO",
  description:
    "Grounded AI lead-response and site-visit scheduling assistant for Prakriti Heights and Vaastu Enclave in Ahmedabad.",
};

export default function ConciergePage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-stone-900/80 backdrop-blur-md px-4 sm:px-8 py-3.5 sticky top-0 z-10 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-stone-300 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Residences</span>
          <span className="sm:hidden">Back</span>
        </Link>

        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-serif text-sm font-semibold tracking-wider text-white">
            ENQUIVO
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">24/7 Grounded AI</span>
          <span className="sm:hidden">24/7</span>
        </div>
      </header>

      {/* Main Concierge Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        <div className="mb-3 sm:mb-4 text-center sm:text-left">
          <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-normal text-white tracking-tight">
            Residential AI Concierge
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-400 leading-relaxed">
            Dedicated consultation for Prakriti Heights (SG Highway) and Vaastu Enclave (Shela). Strictly grounded in verified developer facts.
          </p>
        </div>

        <ConciergeChat className="flex-1 shadow-2xl" />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-3 px-4 text-center text-[10px] text-stone-500">
        RERA Reg: DEMO-ONLY-NOT-VERIFIED • DPDP Act 2023 Digital Consent Enforced • Ahmedabad, Gujarat
      </footer>
    </div>
  );
}
