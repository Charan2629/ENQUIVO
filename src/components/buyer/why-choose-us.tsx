import { ShieldCheck, CalendarCheck, Users2, Sparkles } from "lucide-react";

export function WhyChooseUs() {
  const standards = [
    {
      icon: ShieldCheck,
      title: "Grounded Truth",
      accent: "#13A99A",
      description:
        "Every configuration, unit specification, and price quotation is retrieved strictly from active, verified developer fact sheets. No AI hallucinations or unverified marketing promises.",
    },
    {
      icon: CalendarCheck,
      title: "Direct Site Visit Locks",
      accent: "#D6B56D",
      description:
        "Real-time atomic slot reservations across Prakriti Heights and Vaastu Enclave. Enforces atomic ACID concurrency to guarantee your appointment is never double-booked.",
    },
    {
      icon: Users2,
      title: "Seamless Human Escalation",
      accent: "#102F43",
      description:
        "Negotiation, bespoke floor plan customizations, or loan assistance triggers an instant handoff to a named on-site sales executive with your full conversation history preserved.",
    },
    {
      icon: Sparkles,
      title: "DPDP Act 2023 Compliance",
      accent: "#13A99A",
      description:
        "Digital consent is captured explicitly before consultation begins. You can withdraw consent or opt-out at any time with an instant click, immediately halting notifications.",
    },
  ];

  return (
    <section id="standards" className="py-20 sm:py-28 bg-[#F7F8F4] border-b border-[#102F43]/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#13A99A]">
            Engineering & Compliance Invariants
          </span>
          <h2 className="mt-2 font-serif text-3xl sm:text-5xl font-normal tracking-tight text-[#102F43]">
            Architectural Precision in AI Assistance
          </h2>
          <p className="mt-4 text-sm text-[#183442]/80 leading-relaxed">
            ENQUIVO replaces generic chat bots with a mission-critical property advisory platform built on PostgreSQL relational integrity and strict regulatory safeguards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {standards.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                data-standard-card
                className="p-6 rounded-3xl bg-white border border-[#102F43]/10 shadow-xs hover:shadow-lg transition-all hover:border-[#13A99A]/40 flex flex-col justify-between"
              >
                <div>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${s.accent}15`, color: s.accent }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-[#102F43] mb-2">
                    {s.title}
                  </h3>
                  <p className="text-xs text-[#183442]/75 leading-relaxed">
                    {s.description}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#102F43]/5 flex items-center justify-between text-[11px] font-semibold text-[#13A99A]">
                  <span>Verified Standard</span>
                  <span>0{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
