import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Clock,
  Globe2,
  ShieldCheck,
  ArrowRight,
  Bot,
  User,
  CheckCircle2,
} from "lucide-react";

export function ConciergeCtaSection() {
  return (
    <section id="concierge" className="py-20 sm:py-28 bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-stone-900 px-6 py-12 sm:px-10 sm:py-16 lg:p-16 text-stone-100 shadow-2xl">
          {/* Background subtle geometric glow */}
          <div
            className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 -ml-20 -mb-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Value Proposition & Discovery Guidance */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium text-amber-300 backdrop-blur-xs mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>24/7 Grounded AI Assistant</span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-white leading-tight">
                AI Concierge for Ahmedabad Residences.
              </h2>

              <p className="mt-5 text-sm sm:text-base text-stone-300 leading-relaxed max-w-xl">
                Experience instant, grounded guidance for Prakriti Heights (SG Highway) and Vaastu Enclave (Shela). Ask about 2 & 3 BHK configurations, developer pricing, and scheduled site visits in English, Hindi, or Gujarati.
              </p>

              {/* Concierge Capability Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3.5 border border-white/5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <Globe2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Multilingual EN / HI / GU</h4>
                    <p className="mt-0.5 text-[11px] text-stone-400 leading-relaxed">
                      Fluent in English, Hindi (हिन्दी), and Gujarati (ગુજરાતી) scripts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3.5 border border-white/5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Strict Fact Grounding</h4>
                    <p className="mt-0.5 text-[11px] text-stone-400 leading-relaxed">
                      Zero speculation. Strictly bounded by active, verified developer facts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3.5 border border-white/5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Instant First Response</h4>
                    <p className="mt-0.5 text-[11px] text-stone-400 leading-relaxed">
                      Instant median response time versus the standard 14-hour portal delay.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-3.5 border border-white/5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <MessageSquare className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Sales Executive Handoff</h4>
                    <p className="mt-0.5 text-[11px] text-stone-400 leading-relaxed">
                      Seamless escalation to senior Ahmedabad sales representatives.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <Link
                  href="/concierge"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-xs sm:text-sm font-semibold text-stone-950 shadow-md hover:bg-amber-300 transition-all hover:shadow-lg focus:outline-hidden"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Start a Conversation</span>
                  <ArrowRight className="h-4 w-4 ml-0.5" />
                </Link>

                <Link
                  href="#projects"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-xs sm:text-sm font-medium text-stone-200 hover:bg-white/10 hover:text-white transition-colors focus:outline-hidden"
                >
                  <span>Explore Residences</span>
                </Link>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[10px] text-stone-400">
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>DPDP Act 2023 Digital Consent Enforced • HTTP-only Signed Cookie Sessions</span>
              </div>
            </div>

            {/* Right Column: Polished Concierge Preview Card */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-white/15 bg-stone-950/80 p-5 sm:p-6 shadow-2xl backdrop-blur-md">
                {/* Preview Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-stone-950 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-serif text-sm font-semibold text-white">ENQUIVO Concierge</h3>
                        <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          Live Grounding
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-400">Interactive Preview • Active Session</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 border border-white/10 text-[10px] text-stone-300 font-medium">
                    <span className="text-amber-400 font-bold">EN</span>
                    <span className="text-stone-500">•</span>
                    <span>HI</span>
                    <span className="text-stone-500">•</span>
                    <span>GU</span>
                  </div>
                </div>

                {/* Simulated Conversation Flow */}
                <div className="py-4 space-y-3.5 text-xs">
                  {/* AI Greeting */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-white/10 px-3.5 py-2.5 text-stone-100 border border-white/10 text-xs leading-relaxed">
                      <p>
                        Namaste! Welcome to ENQUIVO. Ask me about 2 & 3 BHK configurations, developer pricing (₹65L–₹1.2Cr), or site visit availability for Prakriti Heights and Vaastu Enclave.
                      </p>
                    </div>
                  </div>

                  {/* User Turn */}
                  <div className="flex items-start justify-end gap-2.5">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-xs bg-amber-400 px-3.5 py-2.5 text-stone-950 font-medium text-xs leading-relaxed shadow-xs">
                      What are the 2 and 3 BHK prices and configurations?
                    </div>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-stone-800 text-stone-300 border border-white/10 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* AI Answer with Grounding Badge */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="max-w-[88%] rounded-2xl rounded-tl-xs bg-white/10 px-3.5 py-2.5 text-stone-100 border border-white/10 text-xs leading-relaxed">
                      <p className="font-medium text-white mb-1">Verified Portfolio Configurations:</p>
                      <ul className="space-y-1 text-stone-300 text-[11px]">
                        <li>• <strong className="text-white">Vaastu Enclave (Shela):</strong> 2 & 3 BHK from ₹65 Lakh to ₹1.2 Crore</li>
                        <li>• <strong className="text-white">Prakriti Heights (SG Highway):</strong> Luxury 3 BHK from ₹85 Lakh</li>
                      </ul>
                      <div className="mt-2.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-emerald-400">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <ShieldCheck className="h-3 w-3" />
                          Grounded in verified facts
                        </span>
                        <span className="text-stone-400 text-[9px]">RERA: DEMO-ONLY</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Banner */}
                <div className="pt-3 border-t border-white/10">
                  <Link
                    href="/concierge"
                    className="w-full flex items-center justify-between rounded-xl bg-amber-400/15 border border-amber-400/30 px-4 py-3 text-xs text-amber-300 hover:bg-amber-400/25 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                      <span className="font-semibold text-white">Ask your own questions in real time</span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 group-hover:translate-x-0.5 transition-transform">
                      Open Concierge <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                  <p className="mt-2 text-center text-[10px] text-stone-500">
                    Dedicated private consultation with live slot booking and human escalation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
