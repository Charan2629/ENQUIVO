import { Sparkles, MessageSquare, Clock, Globe2, ShieldCheck } from "lucide-react";

export function ConciergeCtaSection() {
  return (
    <section id="concierge" className="py-20 sm:py-28 bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-stone-900 px-6 py-16 sm:px-12 sm:py-20 lg:p-20 text-stone-100 shadow-xl">
          {/* Background subtle geometric glow */}
          <div
            className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 -ml-20 -mb-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Proposition */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-medium text-amber-300 backdrop-blur-xs mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Next-Generation Buyer Experience</span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-white leading-tight">
                AI Property Concierge & Private Site-Visit Scheduling.
              </h2>

              <p className="mt-6 text-base sm:text-lg text-stone-300 leading-relaxed max-w-2xl">
                Experience instant, 24/7 lead response for Prakriti Heights and Vaastu Enclave. Our AI Concierge is grounded strictly in verified developer facts, providing accurate pricing, configuration details, and automated slot reservation.
              </p>

              {/* Concierge Capability Grid */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-400">
                    <Globe2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Multilingual Fluency</h4>
                    <p className="mt-1 text-xs text-stone-400">
                      Seamless dialogue in English, Hindi (हिन्दी), and Gujarati (ગુજરાતી).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Instant Lead Response</h4>
                    <p className="mt-1 text-xs text-stone-400">
                      Replies in seconds rather than the traditional 14-hour industry delay.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Strict Fact Grounding</h4>
                    <p className="mt-1 text-xs text-stone-400">
                      Zero speculation. Unlisted amenities or pricing queries trigger human handoff.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-400">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Human Sales Escalation</h4>
                    <p className="mt-1 text-xs text-stone-400">
                      Automatic routing to senior sales executives when specialized care is required.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Concierge Interface Preview & Roadmap Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8 backdrop-blur-md">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">
                      Interactive Concierge
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-stone-400">
                    Milestone 5 • Phase 2
                  </span>
                </div>

                <div className="mt-6 space-y-4 text-xs text-stone-300">
                  <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                    <p className="font-medium text-stone-200 mb-1">
                      📱 Dedicated Mobile Concierge Interface
                    </p>
                    <p className="text-stone-400 leading-relaxed">
                      The full interactive conversational concierge UI — with DPDP 2023 digital consent affirmation, regional language switcher, and live slot calendar — is arriving in Phase 2 of Milestone 5.
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                    <p className="font-medium text-stone-200 mb-1">
                      🔒 Secure Buyer-Session Binding
                    </p>
                    <p className="text-stone-400 leading-relaxed">
                      In accordance with our independent security review, public chat access is being bound to signed buyer session cookies before open exposure.
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-center text-sm font-semibold text-stone-950 shadow-sm cursor-default">
                    <span>Concierge UI Staging in Progress</span>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-stone-400">
                    Backend AIConciergeService & BookingService fully verified.
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
