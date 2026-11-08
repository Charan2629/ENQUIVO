import React from "react";
import { connection } from "next/server";
import { requireSalesHead } from "@/lib/auth-guard";
import { ShieldAlert } from "lucide-react";
import { StaffSessionForbiddenError } from "@/services/auth/staff-auth.service";
import { factSheetService } from "@/services/fact-sheet/fact-sheet.service";
import { FactSheetClient } from "@/components/portal/fact-sheet/fact-sheet-client";

export const instant = false;

export default async function FactSheetPage() {
  await connection();
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

  const initialMetrics = await factSheetService.getFactSheetMetrics();

  return <FactSheetClient initialMetrics={initialMetrics} />;
}
