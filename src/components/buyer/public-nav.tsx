"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Calendar, Menu, X, Sparkles } from "lucide-react";

export function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#102F43]/10 bg-[#F7F8F4]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <Link
          href="/"
          className="group flex items-center gap-3 transition-opacity hover:opacity-90"
          aria-label="ENQUIVO Home"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#102F43] text-[#D6B56D] shadow-sm transition-transform group-hover:scale-105 border border-[#102F43]/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-xl font-bold tracking-widest text-[#102F43]">
              ENQUIVO
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#13A99A]">
              Luxury Residences • Ahmedabad
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-[#183442]/80"
          aria-label="Main Navigation"
        >
          <Link
            href="#projects"
            className="transition-colors hover:text-[#13A99A]"
          >
            Developments
          </Link>
          <Link
            href="#architecture"
            className="transition-colors hover:text-[#13A99A]"
          >
            3D Architecture
          </Link>
          <Link
            href="#standards"
            className="transition-colors hover:text-[#13A99A]"
          >
            Standards
          </Link>
          <Link
            href="/concierge"
            className="flex items-center gap-1.5 text-[#13A99A] hover:text-[#102F43] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#D6B56D]" />
            <span>AI Concierge</span>
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-semibold text-[#183442]/70 hover:text-[#102F43] px-3 py-2 transition-colors"
          >
            Staff Portal
          </Link>

          <Link
            href="/concierge"
            className="inline-flex items-center gap-2 rounded-full bg-[#102F43] px-5 py-2.5 text-xs font-semibold tracking-wide text-[#F7F8F4] shadow-sm transition-all hover:bg-[#13A99A] hover:shadow-md"
          >
            <Calendar className="h-3.5 w-3.5 text-[#D6B56D]" />
            <span>Consult Concierge</span>
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[#102F43] hover:bg-[#E7F4F4] transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#102F43]/10 bg-[#F7F8F4] px-4 pt-4 pb-6 space-y-4 shadow-xl animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-3 text-sm font-medium text-[#183442]">
            <Link
              href="#projects"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-[#E7F4F4] transition-colors"
            >
              Developments
            </Link>
            <Link
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-[#E7F4F4] transition-colors"
            >
              3D Architecture
            </Link>
            <Link
              href="#standards"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-[#E7F4F4] transition-colors"
            >
              Standards
            </Link>
            <Link
              href="/concierge"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg bg-[#E7F4F4] text-[#13A99A] font-semibold flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-[#D6B56D]" />
              <span>AI Concierge (24/7)</span>
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-xs text-[#183442]/70 hover:bg-[#E7F4F4]"
            >
              Staff Operations Login
            </Link>
          </nav>
          <div className="pt-2 border-t border-[#102F43]/10">
            <Link
              href="/concierge"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#102F43] py-3 text-xs font-semibold text-[#F7F8F4] shadow-md hover:bg-[#13A99A]"
            >
              <Calendar className="h-4 w-4 text-[#D6B56D]" />
              <span>Start AI Consultation</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
