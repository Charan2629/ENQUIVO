import React from "react";
import { connection } from "next/server";
import { UserRole } from "@prisma/client";
import { requireStaffSession } from "@/lib/auth-guard";
import { handoffService } from "@/services/handoff/handoff.service";
import { HandoffQueueClient } from "@/components/portal/handoffs/handoff-queue-client";
import { Headphones, Compass } from "lucide-react";

export const instant = false;

export default async function HandoffsPage() {
  await connection();
  const session = await requireStaffSession();
  const { user } = session;

  const [metrics, initialHandoffsData] = await Promise.all([
    handoffService.getHandoffMetrics(user),
    handoffService.getHandoffs(
      {
        page: 1,
        limit: 10,
        status: "ALL",
        reason: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      user
    ),
  ]);
  const isSalesHead = user.role === UserRole.SALES_HEAD;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                AI Handoff & Escalations Queue
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {isSalesHead ? "Full Portfolio Scope" : "Assigned Escalations Only"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and manage buyer inquiries escalated by AI Concierge with full chat transcripts and assignment controls
            </p>
          </div>
        </div>

        {/* Timeline Note */}
        <div className="text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span>Timeline: Active Assessment Period (Nov 2026)</span>
        </div>
      </div>

      {/* Interactive Queue Client */}
      <HandoffQueueClient
        userRole={user.role}
        userName={user.name}
        initialMetrics={metrics}
        initialHandoffs={initialHandoffsData.handoffs}
        initialPagination={initialHandoffsData.pagination}
      />
    </div>
  );
}
