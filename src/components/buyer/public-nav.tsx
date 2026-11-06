"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Calendar, Menu, X, ArrowUpRight } from "lucide-react";

export function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/80 bg-white/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90 transition-colors">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <Link
          href="/"
          className="group flex items-center gap-3 transition-opacity hover:opacity-90"
          aria-label="ENQUIVO Home"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-50 dark:text-stone-950">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-xl font-bold tracking-widest text-stone-900 dark:text-stone-50">
              ENQUIVO
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-stone-500 dark:text-stone-400">
              Residential • Ahmedabad
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600 dark:text-stone-300"
          aria-label="Main Navigation"
        >
          <Link
            href="#projects"
            className="transition-colors hover:text-stone-950 dark:hover:text-stone-50"
          >
            Developments
          </Link>
          <Link
            href="#about"
            className="transition-colors hover:text-stone-950 dark:hover:text-stone-50"
          >
            Portfolio Standards
          </Link>
          <Link
            href="#concierge"
            className="transition-colors hover:text-stone-950 dark:hover:text-stone-50"
          >
            AI Concierge
          </Link>
          <Link
            href="#contact"
            className="transition-colors hover:text-stone-950 dark:hover:text-stone-50"
          >
            Contact
          </Link>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="#concierge"
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-xs font-semibold tracking-wide text-stone-50 shadow-sm transition-all hover:bg-stone-800 hover:shadow-md dark:bg-stone-50 dark:text-stone-950 dark:hover:bg-stone-200"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Schedule Site Visit</span>
          </Link>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-stone-200 bg-white px-4 pt-2 pb-6 md:hidden dark:border-stone-800 dark:bg-stone-950">
          <div className="flex flex-col space-y-4 pt-2 text-base font-medium text-stone-800 dark:text-stone-200">
            <Link
              href="#projects"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-900"
            >
              <span>Developments</span>
              <ArrowUpRight className="h-4 w-4 text-stone-400" />
            </Link>
            <Link
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-900"
            >
              <span>Portfolio Standards</span>
              <ArrowUpRight className="h-4 w-4 text-stone-400" />
            </Link>
            <Link
              href="#concierge"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-900"
            >
              <span>AI Concierge</span>
              <ArrowUpRight className="h-4 w-4 text-stone-400" />
            </Link>
            <Link
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-900"
            >
              <span>Contact</span>
              <ArrowUpRight className="h-4 w-4 text-stone-400" />
            </Link>
            <div className="pt-2">
              <Link
                href="#concierge"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-center text-sm font-semibold text-stone-50 shadow-sm dark:bg-stone-50 dark:text-stone-950"
              >
                <Calendar className="h-4 w-4" />
                <span>Schedule Site Visit</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
