import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";

export function PublicFooter() {
  return (
    <footer id="contact" className="border-t border-stone-200 bg-stone-100/70 text-stone-700 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-50 dark:text-stone-950">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="font-serif text-xl font-bold tracking-widest text-stone-900 dark:text-stone-50">
                ENQUIVO
              </span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-stone-600 dark:text-stone-400 max-w-sm">
              AI-assisted lead-response and site-visit coordination for premium residential developments across SG Highway and Shela, Ahmedabad, Gujarat, India.
            </p>
            <div className="mt-4 text-xs text-stone-500 dark:text-stone-400">
              <p>Corporate Office: Ahmedabad, Gujarat, India</p>
              <p className="mt-1">Display Timezone: Asia/Kolkata (IST, UTC+5:30)</p>
            </div>
          </div>

          {/* Developments */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-200">
              Developments
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="#projects" className="hover:text-stone-950 dark:hover:text-stone-200 transition-colors">
                  Prakriti Heights (SG Highway)
                </Link>
              </li>
              <li>
                <Link href="#projects" className="hover:text-stone-950 dark:hover:text-stone-200 transition-colors">
                  Vaastu Enclave (Shela)
                </Link>
              </li>
              <li className="text-stone-400 dark:text-stone-600">
                420 Contemporary Residences
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-200">
              Navigation
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>
                <Link href="#projects" className="hover:text-stone-950 dark:hover:text-stone-200 transition-colors">
                  Project Showcase
                </Link>
              </li>
              <li>
                <Link href="#about" className="hover:text-stone-950 dark:hover:text-stone-200 transition-colors">
                  Portfolio Standards
                </Link>
              </li>
              <li>
                <Link href="#concierge" className="hover:text-stone-950 dark:hover:text-stone-200 transition-colors">
                  AI Concierge Overview
                </Link>
              </li>
            </ul>
          </div>

          {/* Technology Reference */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-200">
              Platform Architecture
            </h3>
            <p className="mt-4 text-xs leading-relaxed text-stone-500 dark:text-stone-500">
              Modular Monolith on Next.js 16 App Router, Prisma ORM, Neon PostgreSQL, Inngest Cloud, and Google Gemini API.
            </p>
          </div>
        </div>

        {/* Mandatory RERA Disclaimer Box */}
        <div className="mt-12 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <strong className="font-semibold">Statutory RERA Compliance Notice: </strong>
              All project specifications, unit counts (420 total across Prakriti Heights and Vaastu Enclave), configurations (2 & 3 BHK), and pricing (₹65 lakh to ₹1.2 crore) displayed on this platform are derived from verified database seed data for demonstration and technical assessment evaluation purposes only. RERA Registration numbers displayed (<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-900/60">DEMO-ONLY-NOT-VERIFIED</code>) are illustrative placeholders and must not be represented as verified government RERA approvals. This digital application does not constitute an offer for sale, advertisement, or solicitation under the Real Estate (Regulation and Development) Act, 2016.
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between border-t border-stone-200/80 pt-8 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
          <p>© 2026 ENQUIVO. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">
            DPDP Act 2023 Digital Consent & Anti-Hallucination Grounding Enforced.
          </p>
        </div>
      </div>
    </footer>
  );
}
