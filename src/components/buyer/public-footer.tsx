import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-[#102F43]/15 bg-[#102F43] text-[#F7F8F4] pt-14 pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13A99A] text-[#102F43] font-bold">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="font-serif text-xl font-bold tracking-widest text-white">
                ENQUIVO
              </span>
            </div>
            <p className="text-xs text-[#E7F4F4]/75 max-w-sm leading-relaxed">
              Intelligent lead-response and site-visit scheduling assistant for Prakriti Heights (SG Highway) and Vaastu Enclave (Shela) in Ahmedabad, Gujarat.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D6B56D] mb-4">
              Developments
            </h4>
            <ul className="space-y-2.5 text-xs text-[#E7F4F4]/80">
              <li>
                <Link href="#projects" className="hover:text-white transition-colors">
                  Prakriti Heights (SG Highway)
                </Link>
              </li>
              <li>
                <Link href="#projects" className="hover:text-white transition-colors">
                  Vaastu Enclave (Shela)
                </Link>
              </li>
              <li>
                <Link href="/concierge" className="hover:text-[#13A99A] transition-colors">
                  AI Concierge Consultation
                </Link>
              </li>
            </ul>
          </div>

          {/* Portal Operations */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D6B56D] mb-4">
              Staff Access
            </h4>
            <ul className="space-y-2.5 text-xs text-[#E7F4F4]/80">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sales Portal Login
                </Link>
              </li>
              <li>
                <span className="text-[11px] text-white/50">
                  Sales Head & Sales Executive RBAC Enforced
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Regulatory Disclaimer Banner */}
        <div className="my-8 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-[#E7F4F4]/80 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#D6B56D] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">Statutory Regulatory Notice:</strong> Project specifications, pricing, configurations, and registration status (<code className="font-mono bg-[#0B2231] px-1.5 py-0.5 rounded text-[#D6B56D]">RERA Reg: DEMO-ONLY-NOT-VERIFIED</code>) are synthetic demonstration records for technical assessment evaluation only. Digital personal data is processed strictly under the Digital Personal Data Protection (DPDP) Act 2023 with right to revocation.
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/60 pt-4 border-t border-white/5">
          <span>© 2026 ENQUIVO Real Estate Technology. All rights reserved.</span>
          <span>Timeline Anchor: November 3, 2026 • Ahmedabad, Gujarat, India</span>
        </div>
      </div>
    </footer>
  );
}
