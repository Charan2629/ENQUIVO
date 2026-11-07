import React from "react";
import { requireStaffSession } from "@/lib/auth-guard";
import { Headphones } from "lucide-react";

export const instant = false;

export default async function HandoffsPage() {
  await requireStaffSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
          <Headphones className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI Handoff & Escalations Queue</h1>
          <p className="text-xs text-slate-400">Review buyer conversations escalated by AI Concierge</p>
        </div>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
          Milestone 6 • Phase 3
        </div>
        <h2 className="text-lg font-semibold text-white">Handoff Queue & Salesperson Assignment Coming in Phase 3</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Real-time queue of buyer escalations with summary, escalation reason, full chat transcript inspection, and assignment to sales executives.
        </p>
      </div>
    </div>
  );
}
