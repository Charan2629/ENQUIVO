"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Calendar, MapPin } from "lucide-react";
import { SanitizedStaffUser } from "@/services/auth/staff-auth.service";

interface PortalHeaderProps {
  user: SanitizedStaffUser;
}

export function PortalHeader({ user }: PortalHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push("/login");
      router.refresh();
    } catch {
      // Force redirect regardless
      router.push("/login");
    }
  };

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-sm">
      {/* Context Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>Ahmedabad Portfolio (Prakriti Heights & Vaastu Enclave)</span>
        </div>
        <div
          title="Demonstration bookings and bookable slots are anchored to November 3, 2026 per the assessment specification."
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400"
        >
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>Timeline Anchor: Nov 3, 2026</span>
        </div>
      </div>

      {/* Right Actions: User info & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-right">
          <div className="hidden sm:block">
            <div className="text-xs font-semibold text-white">{user.name}</div>
            <div className="text-[10px] text-slate-400">{user.email}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400">
            {user.name.charAt(0)}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800" />

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out of staff portal"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 text-xs text-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>
    </header>
  );
}
