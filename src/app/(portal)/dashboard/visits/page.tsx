import React from "react";
import { requireStaffSession } from "@/lib/auth-guard";
import { CalendarCheck } from "lucide-react";

export const instant = false;

export default async function VisitsPage() {
  await requireStaffSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Site Visits & Attendance Management</h1>
          <p className="text-xs text-slate-400">Appointment scheduling, slot availability, and attendance recording</p>
        </div>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-3">
          Milestone 6 • Phase 4
        </div>
        <h2 className="text-lg font-semibold text-white">Site Visits & Slots Management Coming in Phase 4</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Slot calendar, booking cancellation/rescheduling, verified attendance recording (Attended / No-Show), and reminder history.
        </p>
      </div>
    </div>
  );
}
