"use client";

import React, { useState, useCallback } from "react";
import { LogOut, Calendar, MapPin, Menu } from "lucide-react";
import { SanitizedStaffUser } from "@/services/auth/staff-auth.service";
import { PortalMobileDrawer } from "@/components/portal/portal-nav";

interface PortalHeaderProps {
  user: SanitizedStaffUser;
}

export function PortalHeader({ user }: PortalHeaderProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleCloseMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      window.location.replace("/login");
    } catch {
      // Force redirect regardless
      window.location.replace("/login");
    }
  };

  return (
    <>
      <header className="h-16 bg-[#102F43]/95 border-b border-[#183442] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md text-white">
        {/* Left Section: Mobile Menu Button & Context Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Navigation Drawer Toggle (< md) */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Context Badge with Responsive Truncation */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/90 max-w-[190px] xs:max-w-[240px] sm:max-w-none truncate">
            <MapPin className="w-3.5 h-3.5 text-[#38C2B4] shrink-0" />
            <span className="sm:hidden font-medium truncate">Ahmedabad Portfolio</span>
            <span className="hidden sm:inline truncate">
              Ahmedabad Portfolio (Prakriti Heights & Vaastu Enclave)
            </span>
          </div>

          {/* Timeline Anchor (Hidden on tablets/mobile to prevent crowding) */}
          <div
            title="Demonstration bookings and bookable slots are anchored to November 3, 2026 per the assessment specification."
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B2231]/80 border border-[#183442] text-[11px] text-white/70 shrink-0"
          >
            <Calendar className="w-3 h-3 text-[#D6B56D] shrink-0" />
            <span>Timeline Anchor: Nov 3, 2026</span>
          </div>
        </div>

        {/* Right Section: User Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2 text-right">
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[10px] text-white/60">{user.email}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#183442] border border-[#13A99A]/40 flex items-center justify-center text-xs font-bold text-[#38C2B4]">
              {user.name.charAt(0)}
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign out of staff portal"
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/15 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-xs text-white/80 transition-colors cursor-pointer disabled:cursor-not-allowed"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {loggingOut ? "Signing out..." : "Sign Out"}
            </span>
          </button>
        </div>
      </header>

      {/* Slide-over navigation drawer for mobile screens (< md) */}
      <PortalMobileDrawer
        isOpen={mobileNavOpen}
        onClose={handleCloseMobileNav}
        user={user}
      />
    </>
  );
}
