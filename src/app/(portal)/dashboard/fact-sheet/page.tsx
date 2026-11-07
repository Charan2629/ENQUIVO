import React from "react";
import { requireSalesHead } from "@/lib/auth-guard";
import { FileCheck2, ShieldAlert } from "lucide-react";
import { StaffSessionForbiddenError } from "@/services/auth/staff-auth.service";

export const instant = false;

export default async function FactSheetPage() {
  try {
    await requireSalesHead();
  } catch (err) {
    if (err instanceof StaffSessionForbiddenError) {
      return (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center max-w-xl mx-auto my-12">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white">Access Denied: Sales Head Only</h1>
          <p className="text-xs text-rose-300 mt-2">
            Fact Sheet Governance is strictly restricted to the Sales Head role to prevent unverified data from contaminating the AI Concierge grounding database.
          </p>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <FileCheck2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Fact Sheet Administration</h1>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Sales Head Only
            </span>
          </div>
          <p className="text-xs text-slate-400">Govern verified property facts and AI Concierge grounding scope</p>
        </div>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
          Milestone 6 • Phase 4
        </div>
        <h2 className="text-lg font-semibold text-white">Fact Sheet Editor Coming in Phase 4</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Dual-flag verified fact editor (status = VERIFIED, isActive = true), scope management (PORTFOLIO vs. PROJECT_1 vs. PROJECT_2), and audit logging.
        </p>
      </div>
    </div>
  );
}
