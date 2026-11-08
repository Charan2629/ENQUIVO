"use client";

import React, { useState, useTransition, useSyncExternalStore } from "react";
import { UserRole } from "@prisma/client";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Lock,
  RotateCcw,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { SourceAnalyticsResponse } from "@/types";

interface SourceAnalyticsClientProps {
  userRole: UserRole;
  userName: string;
  initialData: SourceAnalyticsResponse;
}

/**
 * Formats a number to Indian Rupee notation (e.g. ₹12,00,000 or ₹12.00 L)
 */
function formatCurrencyINR(amountRupees: number | null): string {
  if (amountRupees === null || amountRupees === undefined) return "—";
  if (amountRupees >= 100000) {
    const lakhs = amountRupees / 100000;
    return `₹${lakhs.toFixed(2)} L`;
  }
  return `₹${amountRupees.toLocaleString("en-IN")}`;
}

const emptySubscribe = () => () => {};

export function SourceAnalyticsClient({
  userRole,
  userName,
  initialData,
}: SourceAnalyticsClientProps) {
  const [data, setData] = useState<SourceAnalyticsResponse>(initialData);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    initialData.filterApplied.monthYear ?? "2026-11"
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isSalesHead = userRole === UserRole.SALES_HEAD;

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    startTransition(async () => {
      try {
        setError(null);
        const url = `/api/sources/analytics?monthYear=${encodeURIComponent(month)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load source analytics");
        }
        setData(json.data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  };

  const handleRefresh = () => {
    handleMonthChange(selectedMonth);
  };

  // Chart data transforms
  const barChartData = data.sources.map((s) => ({
    name: s.label.replace(" Ads", "").replace(" Direct", ""),
    fullName: s.label,
    leads: s.totalLeads,
    visits: s.attendedVisitsCount,
    booked: s.bookedVisitsCount,
    color: s.color,
  }));

  const spendPieData = data.sources
    .filter((s) => (s.spendRupees ?? 0) > 0)
    .map((s) => ({
      name: s.label,
      value: s.spendRupees ?? 0,
      color: s.color,
    }));

  const efficiencyData = data.sources
    .filter((s) => s.spendRupees !== null && (s.costPerLeadRupees !== null || s.costPerAttendedVisitRupees !== null))
    .map((s) => ({
      name: s.label.replace(" Ads", "").replace(" Direct", ""),
      cpl: s.costPerLeadRupees ?? 0,
      cpv: s.costPerAttendedVisitRupees ?? 0,
      color: s.color,
    }));

  const touchpointPieData = data.multiTouchBreakdown
    .filter((m) => m.count > 0)
    .map((m) => {
      const meta = data.sources.find((s) => s.source === m.source);
      return {
        name: m.label,
        value: m.count,
        color: meta?.color ?? "#64748b",
      };
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-950/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Source Attribution & Marketing ROI
              </h1>
              {isSalesHead ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Sales Head • Org Spend Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Lock className="w-3.5 h-3.5" />
                  Sales Exec • Assigned Leads Scoped
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              First-touch acquisition channels, visit conversion efficiency, and CPL ledger • Staff: {userName}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={isPending}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              {data.availableMonths.map((m) => (
                <option key={m} value={m} className="bg-slate-900 text-white">
                  {m === "2026-11" ? "November 2026 (Operational)" : m}
                </option>
              ))}
              <option value="ALL" className="bg-slate-900 text-white">
                All Recorded Time
              </option>
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RotateCcw className={`w-4 h-4 ${isPending ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Spend */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Channel Spend</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {isSalesHead ? formatCurrencyINR(data.summary.totalSpendRupees) : "Restricted"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isSalesHead ? (
                <span className="text-cyan-400 font-mono">₹30L Demo Allocation</span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Policy Restricted
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Card 2: Attributed Leads */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Distinct Leads</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {data.summary.totalDistinctLeads}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              100% first-touch deduplicated
            </p>
          </div>
        </div>

        {/* Card 3: Overall CPL */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Cost Per Lead (CPL)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {isSalesHead ? formatCurrencyINR(data.summary.overallCPLRupees) : "Restricted"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isSalesHead ? "Spend ÷ Distinct Leads" : "Sales Head Only"}
            </p>
          </div>
        </div>

        {/* Card 4: Booked Visits */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Booked Visits</span>
            <CalendarCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {data.summary.totalBookedVisits}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="text-blue-400 font-medium">
                {data.summary.overallLeadToVisitRate}%
              </span>{" "}
              lead-to-visit rate
            </p>
          </div>
        </div>

        {/* Card 5: Attended Visits */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Attended Visits</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {data.summary.totalAttendedVisits}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="text-emerald-400 font-medium">
                {data.summary.overallLeadToAttendedRate}%
              </span>{" "}
              lead-to-attended
            </p>
          </div>
        </div>

        {/* Card 6: Response Time vs Baseline */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between bg-gradient-to-br from-slate-900 to-cyan-950/20">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Median AI Response</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {data.summary.firstResponseTimeMedianMinutes !== null
                ? `${data.summary.firstResponseTimeMedianMinutes} min`
                : "—"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              vs 14h (840 min) industry baseline
            </p>
          </div>
        </div>
      </div>

      {/* 3. Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Chart (2 cols): Lead Volume & Attended Visits by Source */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                First-Touch Acquisition & Site Visit Conversion
              </h2>
              <p className="text-xs text-slate-400">
                Distinct acquired leads vs attended physical site visits across acquisition channels
              </p>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
              First-Touch Attribution
            </span>
          </div>

          <div className="h-64 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#102F43",
                      borderColor: "#183442",
                      borderRadius: "0.5rem",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                  />
                  <Bar dataKey="leads" name="Distinct Leads" fill="#13A99A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="visits" name="Attended Visits" fill="#D6B56D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Chart (1 col): Spend Share (Sales Head) OR Multi-Touch Distribution (Sales Exec) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">
              {isSalesHead ? "Marketing Spend Allocation" : "Multi-Touch Engagement Velocity"}
            </h2>
            <p className="text-xs text-slate-400">
              {isSalesHead
                ? "Illustrative ₹30 Lakh monthly allocation across marketing media"
                : "Channel touchpoint event distribution across customer journeys"}
            </p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={isSalesHead ? spendPieData : touchpointPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(isSalesHead ? spendPieData : touchpointPieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) =>
                      isSalesHead
                        ? [formatCurrencyINR(typeof value === "number" ? value : Number(value)), "Spend"]
                        : [`${value} touchpoints`, "Events"]
                    }
                    contentStyle={{
                      backgroundColor: "#102F43",
                      borderColor: "#183442",
                      borderRadius: "0.5rem",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 4. Second Visual Row: Cost Per Visit & Cost Per Lead (Sales Head) */}
      {isSalesHead && efficiencyData.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Acquisition Efficiency Comparison (CPL vs CPV)
              </h2>
              <p className="text-xs text-slate-400">
                Cost per inquiry lead vs cost per verified physically attended site visit
              </p>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Spend Efficiency Ledger
            </span>
          </div>

          <div className="h-60 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efficiencyData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${val / 1000}k` : val}`}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      formatCurrencyINR(typeof value === "number" ? value : Number(value)),
                      name === "cpl" ? "Cost Per Lead (CPL)" : "Cost Per Attended Visit (CPV)",
                    ]}
                    contentStyle={{
                      backgroundColor: "#102F43",
                      borderColor: "#183442",
                      borderRadius: "0.5rem",
                      color: "#f8fafc",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                  />
                  <Bar dataKey="cpl" name="Cost Per Lead (CPL)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cpv" name="Cost Per Attended Visit (CPV)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* 5. Comprehensive Performance Ledger Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Channel Performance Ledger</h2>
          </div>
          <span className="text-xs text-slate-400">
            {data.sources.length} Recognized Channels
          </span>
        </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Channel</th>
                <th className="py-3 px-3 font-semibold text-right">Spend (INR)</th>
                <th className="py-3 px-3 font-semibold text-right">Leads</th>
                <th className="py-3 px-3 font-semibold text-right">Lead Share</th>
                <th className="py-3 px-3 font-semibold text-right">CPL</th>
                <th className="py-3 px-3 font-semibold text-right">Booked Visits</th>
                <th className="py-3 px-3 font-semibold text-right">Attended</th>
                <th className="py-3 px-3 font-semibold text-right">Lead→Visit %</th>
                <th className="py-3 px-3 font-semibold text-right">Show-Up %</th>
                <th className="py-3 px-3 font-semibold text-right">CPV (Attended)</th>
                <th className="py-3 px-4 font-semibold text-right">Touchpoints</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {data.sources.map((item) => (
                <tr key={item.source} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono">
                    {isSalesHead ? formatCurrencyINR(item.spendRupees) : "Restricted"}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold text-white font-mono">
                    {item.totalLeads}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-400 font-mono">
                    {item.leadsPercentage}%
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-purple-300">
                    {isSalesHead ? formatCurrencyINR(item.costPerLeadRupees) : "—"}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-blue-300">
                    {item.bookedVisitsCount}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                    {item.attendedVisitsCount}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-cyan-300">
                    {item.leadToVisitRate}%
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono">
                    {item.showUpRate !== null ? (
                      <span
                        className={
                          item.showUpRate >= 70
                            ? "text-emerald-400"
                            : item.showUpRate >= 40
                            ? "text-amber-400"
                            : "text-red-400"
                        }
                      >
                        {item.showUpRate}%
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-amber-300 font-semibold">
                    {isSalesHead ? formatCurrencyINR(item.costPerAttendedVisitRupees) : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                    {item.totalTouchpointEvents}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Summary Footer */}
            <tfoot className="bg-slate-950/80 font-semibold text-white border-t border-slate-700">
              <tr>
                <td className="py-3.5 px-4">Organization Total</td>
                <td className="py-3.5 px-3 text-right font-mono text-cyan-400">
                  {isSalesHead ? formatCurrencyINR(data.summary.totalSpendRupees) : "Restricted"}
                </td>
                <td className="py-3.5 px-3 text-right font-mono">{data.summary.totalDistinctLeads}</td>
                <td className="py-3.5 px-3 text-right font-mono text-slate-400">100.0%</td>
                <td className="py-3.5 px-3 text-right font-mono text-purple-300">
                  {isSalesHead ? formatCurrencyINR(data.summary.overallCPLRupees) : "—"}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-blue-300">
                  {data.summary.totalBookedVisits}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-emerald-400">
                  {data.summary.totalAttendedVisits}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-cyan-300">
                  {data.summary.overallLeadToVisitRate}%
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-slate-400">—</td>
                <td className="py-3.5 px-3 text-right font-mono text-amber-300">
                  {isSalesHead ? formatCurrencyINR(data.summary.overallCPVAttendedRupees) : "—"}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                  {data.multiTouchBreakdown.reduce((acc, m) => acc + m.count, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 6. Transparency, Assumption & Revenue Disclaimers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Illustrative Spend & First-Touch Attribution Assumption</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            <span className="text-cyan-400 font-semibold">[ASSUMPTION — Illustrative Demo Allocation]</span>: Marketing spend is seeded at ₹30 Lakh/month across 4 primary channels (Property Portal, Social Ads, Website, Billboard Hoarding) based on representative Ahmedabad real estate advertising costs. Channel attribution honors the prospect&apos;s initial acquisition touchpoint on duplicate phone merge.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Commercial Sales Revenue Segregation Notice</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            <span className="text-amber-400 font-semibold">Commercial Sales Revenue Not Captured in CRM</span>: Closed property unit sales, deed registrations, and booked revenue are governed externally in enterprise ERP/financial accounting ledgers. The CRM tracks verified spend-efficiency (CPL, CPV, and visit conversion rate) rather than synthetic return-on-ad-spend (ROAS).
          </p>
        </div>
      </div>
    </div>
  );
}
