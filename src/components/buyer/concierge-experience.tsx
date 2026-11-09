"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Building2, ShieldAlert } from "lucide-react";
import { ConciergeChat } from "@/components/buyer/concierge-chat";
import {
  CONCIERGE_TRANSLATIONS,
  type Language,
} from "@/lib/i18n/concierge-translations";

export function ConciergeExperience() {
  const [language, setLanguage] = useState<Language>("EN");
  const t = CONCIERGE_TRANSLATIONS[language];

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#102F43] flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-[#183442] bg-[#102F43] text-white px-4 sm:px-8 py-3.5 sticky top-0 z-20 flex items-center justify-between gap-2 shadow-sm">
        <Link
          href="/"
          className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold text-white/80 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-[#D6B56D]" />
          <span className="hidden sm:inline">{t.backToResidences}</span>
          <span className="sm:hidden">{t.backToResidences.split(" ")[0]}</span>
        </Link>

        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#D6B56D] shrink-0" />
          <span className="font-serif text-sm sm:text-base font-semibold tracking-wider text-white">
            {t.brandTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[#38C2B4] font-semibold bg-[#13A99A]/20 px-2.5 py-1 rounded-full border border-[#13A99A]/30 shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t.aiBadge}</span>
          <span className="sm:hidden">24/7 AI</span>
        </div>
      </header>

      {/* Main Concierge Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 py-6 sm:p-8 flex flex-col justify-center">
        <div className="mb-4 sm:mb-6 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F4F4] border border-[#13A99A]/25 text-[11px] font-semibold text-[#0D7A6F] mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13A99A]" />
            {t.portfolioBadge}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-[#102F43] tracking-tight">
            {t.assistantHeaderTitle}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#102F43]/75 leading-relaxed max-w-2xl">
            {t.assistantSubtitle}
          </p>
        </div>

        <ConciergeChat
          className="flex-1"
          language={language}
          onLanguageChange={setLanguage}
        />

        {/* Statutory Compliance Banner */}
        <div className="mt-5 p-4 rounded-xl bg-[#E7F4F4] border border-[#13A99A]/30 text-xs text-[#102F43] flex items-start gap-3 shadow-2xs">
          <ShieldAlert className="h-4.5 w-4.5 text-[#13A99A] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-[#102F43] font-semibold">
              {t.statutoryNoticeTitle}
            </strong>{" "}
            {t.statutoryNoticeBody}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#102F43]/10 bg-white py-3 px-4 text-center text-[11px] text-[#102F43]/60 font-medium">
        {t.footerCompliance}
      </footer>
    </div>
  );
}

