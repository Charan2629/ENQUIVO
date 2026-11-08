import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Clock, MessageSquare } from "lucide-react";

export function ConciergeCtaSection() {
  return (
    <section id="concierge" className="py-20 sm:py-28 bg-[#102F43] text-[#F7F8F4] relative overflow-hidden">
      {/* Ambient Lighting Gradient */}
      <div className="absolute inset-0 bg-radial from-[#13A99A]/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15 p-8 sm:p-14 shadow-2xl backdrop-blur-md text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#13A99A]/20 text-[#13A99A] border border-[#13A99A]/30 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#D6B56D]" />
            <span>24/7 Intelligent Consultation</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
            Consult the ENQUIVO AI Concierge
          </h2>

          <p className="mt-4 text-sm sm:text-base text-[#E7F4F4]/80 max-w-2xl mx-auto leading-relaxed">
            Inquire in English, Hindi, or Gujarati regarding available 2 & 3 BHK configurations, price breakdowns, and schedule an exclusive on-site visit with our dedicated sales team.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/concierge"
              className="flex h-13 w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-[#13A99A] px-9 text-sm font-semibold text-[#F7F8F4] shadow-lg hover:bg-[#0D7A6F] transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Launch AI Concierge Now</span>
            </Link>

            <Link
              href="/login"
              className="flex h-13 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              <span>Staff Management Portal</span>
              <ArrowRight className="h-4 w-4 text-[#D6B56D]" />
            </Link>
          </div>

          {/* Guarantee Badges */}
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#E7F4F4]/70">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-[#D6B56D]" />
              <span>Instant Response vs 14h Baseline</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#13A99A]" />
              <span>DPDP Act 2023 Digital Consent</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D6B56D]" />
              <span>Verified Facts Grounding Only</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
