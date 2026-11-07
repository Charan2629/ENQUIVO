import React from "react";
import { requireStaffSession } from "@/lib/auth-guard";
import { Users } from "lucide-react";

export const instant = false;

export default async function LeadsPage() {
  await requireStaffSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Lead Pipeline & Ingestion</h1>
          <p className="text-xs text-slate-400">Search, filter, and inspect qualified buyer leads</p>
        </div>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
          Milestone 6 • Phase 2
        </div>
        <h2 className="text-lg font-semibold text-white">Lead Pipeline Interface Coming in Phase 2</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Full lead list with real-time search, qualification status, first-touch attribution channels, and lead detail view.
        </p>
      </div>
    </div>
  );
}
