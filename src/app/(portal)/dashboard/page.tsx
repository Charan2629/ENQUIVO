import React from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireStaffSession } from "@/lib/auth-guard";
import { leadService } from "@/services/lead/lead.service";
import {
  Users,
  Headphones,
  CalendarCheck,
  FileCheck2,
  BarChart3,
  ShieldCheck,
  Building2,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  Globe,
  Activity,
} from "lucide-react";

export const instant = false;

export default async function DashboardPage() {
  const session = await requireStaffSession();
  const { user, payload } = session;

  const [metrics] = await Promise.all([
    leadService.getLeadMetrics(user),
  ]);

  const isSalesHead = user.role === UserRole.SALES_HEAD;
  const sessionExpiresAt = new Date(payload.expiresAt).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/80 border border-slate-800 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authenticated Session • Revalidated from DB</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              ENQUIVO Staff Operations Console. Manage live buyer inquiries, review AI handoffs, monitor site-visit schedules, and govern verified property facts.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shrink-0 flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                Assigned Role
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                {isSalesHead ? "Sales Head (Admin)" : "Sales Executive"}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                Session Active Until
              </div>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{sessionExpiresAt} IST</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Database Lead Overview Metrics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Live Pipeline Overview
            </h2>
            <p className="text-xs text-slate-400">
              {isSalesHead
                ? "Portfolio-wide lead metrics derived from live PostgreSQL records"
                : "Lead metrics scoped specifically to your assigned accounts"}
            </p>
          </div>
          <Link
            href="/dashboard/leads"
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>View All Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">Total Inquiries</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {metrics.totalLeads}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>{metrics.byStatus.NEW} new</span>
              <span>•</span>
              <span>{metrics.byStatus.ENGAGED} engaged</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">Visits Booked</span>
              <CalendarCheck className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {metrics.byStatus.BOOKED}
            </div>
            <div className="text-[11px] text-blue-400/80 mt-1">
              Active appointment slots
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">Attended Visits</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {metrics.byStatus.VISITED}
            </div>
            <div className="text-[11px] text-teal-400/80 mt-1">
              Physically verified on site
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium">Escalated Leads</span>
              <Headphones className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {metrics.byStatus.ESCALATED}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1">
              Active handoff, awaiting visit
            </div>
          </div>
        </div>

        {/* 2 Breakdown Columns: Source Breakdown & Recent Touchpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Breakdown */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-white border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Leads by Acquisition Source</span>
              </div>
              <span className="text-slate-500 font-normal">First-touch attribution</span>
            </div>

            <div className="space-y-2 text-xs">
              {Object.entries(metrics.bySource).map(([src, count]) => {
                const total = metrics.totalLeads || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={src} className="flex items-center justify-between gap-3">
                    <span className="text-slate-400 capitalize">
                      {src.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-white font-medium w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Distribution & Activity */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-white border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Project Interest Distribution</span>
              </div>
              <span className="text-slate-500 font-normal">Ahmedabad Portfolio</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {metrics.byProject.map((proj) => (
                <div
                  key={proj.projectId || "general"}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium text-slate-200">
                      {proj.projectName}
                    </span>
                  </div>
                  <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {proj.count} leads
                  </span>
                </div>
              ))}

              {metrics.recentActivity.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>Latest Activity</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="font-medium text-white">
                      {metrics.recentActivity[0].leadName}
                    </span>{" "}
                    ({metrics.recentActivity[0].leadCode}) •{" "}
                    <span className="text-slate-400">
                      {metrics.recentActivity[0].description}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Operations Quick Action Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Operations Modules
          </h2>
          <span className="text-xs text-slate-500">M6 Operations Architecture</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Module 1: Lead Pipeline */}
          <Link
            href="/dashboard/leads"
            className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-emerald-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Lead Pipeline & Ingestion
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Filter leads by status, view first-touch attribution channels, merge duplicates, and inspect qualification criteria.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-emerald-400">
              <span>Open Lead List</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Module 2: Handoff Queue */}
          <Link
            href="/dashboard/handoffs"
            className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-emerald-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                AI Handoff & Escalations
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Review buyer conversations escalated by AI Concierge for price negotiation, missing project info, or buyer request.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-blue-400">
              <span>View Escalation Queue</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Module 3: Site Visits */}
          <Link
            href="/dashboard/visits"
            className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-emerald-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                Site Visits & Attendance
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Manage appointment slots, record verified buyer attendance (Attended / No-Show), and view automated 24h/2h reminders.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-purple-400">
              <span>Manage Appointments</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Module 4: Fact Sheet Editor (Role-Gated) */}
          {isSalesHead ? (
            <Link
              href="/dashboard/fact-sheet"
              className="group p-5 rounded-xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-all hover:shadow-lg hover:shadow-amber-950/20 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                    Fact Sheet Governance
                  </h3>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Sales Head
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  Approve, draft, and govern verified facts. Strict AI dual-flag protection ensures only VERIFIED + ACTIVE facts reach buyers.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-amber-400">
                <span>Manage Fact Sheet</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ) : (
            <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800/60 opacity-60 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-800 text-slate-500 flex items-center justify-center mb-4">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-400">Fact Sheet Governance</h3>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-500">
                    Restricted
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Fact Sheet editing and verification approvals are restricted to Sales Head role per governance policy.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-600">
                Requires SALES_HEAD permission
              </div>
            </div>
          )}

          {/* Module 5: Source Performance & Spend */}
          <Link
            href="/dashboard/sources"
            className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-emerald-950/20 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Source Attribution & ROI
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Track channel spend (₹30L allocation), cost per lead, visit conversion, and show-up rates with sample-size safeguards.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-medium text-cyan-400">
              <span>View Source Metrics</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Module 6: Property Overview Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Ahmedabad Property Portfolio
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                420 residential apartments across Prakriti Heights (SG Highway) and Vaastu Enclave (Shela). 2 & 3 BHK formats (₹65L - ₹1.2 Cr).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>RERA Reg: DEMO-ONLY-NOT-VERIFIED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
