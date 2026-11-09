import React from "react";
import { connection } from "next/server";
import { UserRole } from "@prisma/client";
import { requireStaffSession } from "@/lib/auth-guard";
import { leadService } from "@/services/lead/lead.service";
import { LeadPipelineClient } from "@/components/portal/leads/lead-pipeline-client";
import {
  Users,
  Sparkles,
  CalendarCheck,
  CheckCircle2,
  Compass,
} from "lucide-react";

export const instant = false;

export default async function LeadsPage() {
  await connection();
  const session = await requireStaffSession();
  const { user } = session;

  const [metrics, projects, initialLeadsData] = await Promise.all([
    leadService.getLeadMetrics(user),
    leadService.getProjectsList(),
    leadService.getLeads(
      { page: 1, limit: 10, status: "ALL", sortBy: "createdAt", sortOrder: "desc" },
      user
    ),
  ]);

  const isSalesHead = user.role === UserRole.SALES_HEAD;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Lead Pipeline & Ingestion
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {isSalesHead ? "Full Portfolio Scope" : "Assigned Leads Only"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live database-backed buyer inquiries, multi-touch attribution, and lifecycle tracking
            </p>
          </div>
        </div>

        {/* Timeline Note */}
        <div className="text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span>Timeline: Active Assessment Period (Nov 2026)</span>
        </div>
      </div>

      {/* Database-Backed Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Leads */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Leads</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.totalLeads}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {isSalesHead ? "Entire database" : "Assigned to you"}
          </div>
        </div>

        {/* New Inquiries */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">New Inquiries</span>
            <Sparkles className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.byStatus.NEW}
          </div>
          <div className="text-[10px] text-sky-400/80 mt-1">
            Awaiting response
          </div>
        </div>

        {/* Engaged / Active Chat */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Engaged</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.byStatus.ENGAGED}
          </div>
          <div className="text-[10px] text-purple-400/80 mt-1">
            Active conversation
          </div>
        </div>

        {/* Booked Site Visits */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Visits Booked</span>
            <CalendarCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.byStatus.BOOKED}
          </div>
          <div className="text-[10px] text-blue-400/80 mt-1">
            Appointment reserved
          </div>
        </div>

        {/* Visited (Attended) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Visits Attended</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.byStatus.VISITED}
          </div>
          <div className="text-[10px] text-teal-400/80 mt-1">
            Verified attendance
          </div>
        </div>
      </div>

      {/* Main Interactive Lead Table & Filter Component */}
      <LeadPipelineClient
        userRole={user.role}
        userName={user.name}
        projects={projects}
        initialLeads={initialLeadsData.leads}
        initialPagination={initialLeadsData.pagination}
      />
    </div>
  );
}
