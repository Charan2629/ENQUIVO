"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UserRole,
  HandoffStatus,
  EscalationReason,
} from "@prisma/client";
import {
  Search,
  RotateCcw,
  Headphones,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  DollarSign,
  Building,
  Sparkles,
  X,
} from "lucide-react";
import {
  HandoffListItem,
  HandoffPagination,
  HandoffMetrics,
  HandoffDetail,
} from "@/types";
import { AssignHandoffModal } from "./assign-handoff-modal";
import { TranscriptModal } from "./transcript-modal";

interface HandoffQueueClientProps {
  userRole: UserRole;
  userName: string;
  initialMetrics: HandoffMetrics;
}

export function HandoffQueueClient({
  userRole,
  userName,
  initialMetrics,
}: HandoffQueueClientProps) {
  // Query Filters & State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [reason, setReason] = useState<string>("ALL");
  const [assignedToId, setAssignedToId] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Data & Metrics State
  const [handoffs, setHandoffs] = useState<HandoffListItem[]>([]);
  const [pagination, setPagination] = useState<HandoffPagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [metrics, setMetrics] = useState<HandoffMetrics>(initialMetrics);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal States
  const [selectedHandoffForAssignment, setSelectedHandoffForAssignment] =
    useState<HandoffListItem | null>(null);
  const [transcriptHandoffId, setTranscriptHandoffId] = useState<string | null>(
    null
  );
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(
    null
  );

  const isSalesHead = userRole === UserRole.SALES_HEAD;

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load handoffs data from API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", limit.toString());
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);

        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim());
        }
        if (status !== "ALL") {
          params.set("status", status);
        }
        if (reason !== "ALL") {
          params.set("reason", reason);
        }
        if (isSalesHead && assignedToId !== "ALL") {
          params.set("assignedToId", assignedToId);
        }

        const res = await fetch(`/api/handoffs?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to fetch handoffs");
        }

        if (!cancelled) {
          setHandoffs(json.data);
          setPagination(json.pagination);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error fetching handoffs");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    page,
    limit,
    debouncedSearch,
    status,
    reason,
    assignedToId,
    sortBy,
    sortOrder,
    refreshKey,
    isSalesHead,
  ]);

  // Refresh metrics when handoffs update
  const refreshMetrics = async () => {
    try {
      const res = await fetch("/api/handoffs/metrics");
      const json = await res.json();
      if (res.ok) {
        setMetrics(json.data);
      }
    } catch {
      // Metrics refresh failure is non-blocking
    }
  };

  const handleAssignmentComplete = (updated: HandoffDetail) => {
    setActionSuccessMessage(
      `Handoff for ${updated.lead.name} (${updated.lead.leadCode}) assigned to ${updated.assignedTo?.name || "Sales Executive"}`
    );
    setTimeout(() => setActionSuccessMessage(null), 5000);
    setRefreshKey((prev) => prev + 1);
    refreshMetrics();
  };

  const handleResolveHandoff = async (handoffId: string, leadName: string) => {
    if (!confirm(`Mark escalation for ${leadName} as RESOLVED?`)) return;

    try {
      const res = await fetch(`/api/handoffs/${handoffId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: HandoffStatus.RESOLVED }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to resolve handoff");

      setActionSuccessMessage(`Escalation for ${leadName} marked as Resolved.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
      setRefreshKey((prev) => prev + 1);
      refreshMetrics();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error resolving handoff");
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("ALL");
    setReason("ALL");
    setAssignedToId("ALL");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const isFiltered =
    Boolean(search) ||
    status !== "ALL" ||
    reason !== "ALL" ||
    assignedToId !== "ALL";

  const formatIST = (dateStr: Date | string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getReasonBadge = (r: EscalationReason) => {
    switch (r) {
      case EscalationReason.PRICE_NEGOTIATION:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <DollarSign className="w-3 h-3" />
            <span>Price Negotiation</span>
          </span>
        );
      case EscalationReason.MISSING_PROJECT_INFO:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Building className="w-3 h-3" />
            <span>Missing Project Info</span>
          </span>
        );
      case EscalationReason.UNLISTED_AMENITY:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Sparkles className="w-3 h-3" />
            <span>Unlisted Amenity</span>
          </span>
        );
      case EscalationReason.BUYER_REQUESTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Users className="w-3 h-3" />
            <span>Buyer Requested Human</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <HelpCircle className="w-3 h-3" />
            <span>Other Escalation</span>
          </span>
        );
    }
  };

  const getStatusBadge = (st: HandoffStatus, hasAssignee: boolean) => {
    if (st === HandoffStatus.RESOLVED) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
          <CheckCircle2 className="w-3 h-3" />
          <span>Resolved</span>
        </span>
      );
    }
    if (st === HandoffStatus.ASSIGNED && hasAssignee) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
          <UserCheck className="w-3 h-3" />
          <span>Assigned</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Unassigned (Pending)</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Escalations */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Escalations</span>
            <Headphones className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.totalHandoffs}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {isSalesHead ? "Entire developer portfolio" : "Assigned to your queue"}
          </div>
        </div>

        {/* Unassigned / Action Required */}
        {isSalesHead && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
            {metrics.unassignedCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Needs Assignment</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">
              {metrics.unassignedCount}
            </div>
            <div className="text-[10px] text-amber-400/80 mt-1">
              Awaiting salesperson allocation
            </div>
          </div>
        )}

        {/* Assigned */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Currently Assigned</span>
            <UserCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.assignedCount}
          </div>
          <div className="text-[10px] text-blue-400/80 mt-1">
            In active sales communication
          </div>
        </div>

        {/* Resolved */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.resolvedCount}
          </div>
          <div className="text-[10px] text-teal-400/80 mt-1">
            Completed or visit booked
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search, Action & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Top Controls: Search + Reset */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by buyer name, phone, or lead code..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs / Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { label: "All Escalations", value: "ALL" },
            ...(isSalesHead
              ? [{ label: `Needs Assignment (${metrics.unassignedCount})`, value: "UNASSIGNED" }]
              : []),
            { label: "Assigned", value: "ASSIGNED" },
            { label: "Resolved", value: "RESOLVED" },
          ].map((pill) => {
            const isActive = status === pill.value;
            const isUnassignedPill = pill.value === "UNASSIGNED";

            return (
              <button
                key={pill.value}
                onClick={() => {
                  setStatus(pill.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? isUnassignedPill
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "bg-emerald-500 text-slate-950 font-semibold shadow-md shadow-emerald-500/20"
                    : "bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          {/* Reason Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Escalation Reason
            </label>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="ALL">All Escalation Reasons</option>
              <option value={EscalationReason.PRICE_NEGOTIATION}>Price Negotiation</option>
              <option value={EscalationReason.MISSING_PROJECT_INFO}>Missing Project Info</option>
              <option value={EscalationReason.UNLISTED_AMENITY}>Unlisted Amenity</option>
              <option value={EscalationReason.BUYER_REQUESTED}>Buyer Requested Human</option>
              <option value={EscalationReason.OTHER}>Other Reason</option>
            </select>
          </div>

          {/* Assignee Filter (Sales Head only) */}
          {isSalesHead && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Salesperson Ownership
              </label>
              <select
                value={assignedToId}
                onChange={(e) => {
                  setAssignedToId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="ALL">All Salespeople</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                {metrics.eligibleExecutives.map((exec) => (
                  <option key={exec.id} value={exec.id}>
                    {exec.name} ({exec.activeLeadCount} active)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Control */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Sort By
            </label>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="createdAt">Escalated Date</option>
                <option value="status">Status</option>
                <option value="resolvedAt">Resolved Date</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 hover:text-white"
                title="Toggle sort direction"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="p-4 md:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-xs">Loading queue items...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-white font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && handoffs.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No Handoff Records Found</h3>
            {isFiltered ? (
              <div>
                {status === "UNASSIGNED" && !search && reason === "ALL" && assignedToId === "ALL" ? (
                  <p className="text-xs text-emerald-400 max-w-sm mx-auto mt-1 mb-3">
                    All buyer escalations have been assigned to sales executives. Great work!
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-3">
                    No escalations match your selected filter criteria.
                  </p>
                )}
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Clear Filters
                </button>
              </div>
            ) : !isSalesHead ? (
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                You do not currently have any buyer escalations assigned to your queue, {userName}. When the Sales Head assigns a handoff to your account, it will appear here.
              </p>
            ) : (
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                The AI handoff queue is currently clear.
              </p>
            )}
          </div>
        )}

        {/* Desktop Data Table */}
        {!isLoading && !error && handoffs.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Buyer Lead</th>
                    <th className="py-3 px-4">Escalation Trigger</th>
                    <th className="py-3 px-4">AI Summary & Transcript</th>
                    <th className="py-3 px-4">Escalated Time</th>
                    <th className="py-3 px-4">Assigned Salesperson</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {handoffs.map((h) => {
                    const isUnassigned = !h.assignedTo;

                    return (
                      <tr
                        key={h.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Buyer Lead */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">
                            <Link
                              href={`/dashboard/leads/${h.lead.id}`}
                              className="hover:text-emerald-300 transition-colors flex items-center gap-1.5"
                            >
                              <span>{h.lead.name}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-emerald-400/90 font-medium">
                              {h.lead.leadCode}
                            </span>
                            <span>•</span>
                            <span>{h.lead.phone || "No phone"}</span>
                          </div>
                        </td>

                        {/* Escalation Trigger */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {getReasonBadge(h.escalationReason)}
                            <div className="text-[10px] text-slate-500">
                              Language: {h.language}
                            </div>
                          </div>
                        </td>

                        {/* Summary & Transcript Trigger */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-slate-300 line-clamp-2 text-xs leading-relaxed">
                            {h.summary}
                          </p>
                          <button
                            onClick={() => setTranscriptHandoffId(h.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 mt-1 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Read Chat Transcript ({h.messageCount} turns)</span>
                          </button>
                        </td>

                        {/* Escalated Time */}
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {formatIST(h.createdAt)}
                        </td>

                        {/* Assigned Salesperson */}
                        <td className="py-3.5 px-4">
                          {isUnassigned ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span>Needs Assignment</span>
                            </span>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">
                                {h.assignedTo?.name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {h.assignedTo?.email}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {isSalesHead ? (
                              <button
                                onClick={() => setSelectedHandoffForAssignment(h)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isUnassigned
                                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 font-bold"
                                    : "border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800"
                                }`}
                              >
                                {isUnassigned ? "Assign Executive" : "Reassign"}
                              </button>
                            ) : (
                              h.status !== HandoffStatus.RESOLVED && (
                                <button
                                  onClick={() => handleResolveHandoff(h.id, h.lead.name)}
                                  className="px-3 py-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark Resolved</span>
                                </button>
                              )
                            )}

                            <Link
                              href={`/dashboard/leads/${h.lead.id}`}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-colors"
                              title="View full lead dossier"
                            >
                              Dossier
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {handoffs.map((h) => {
                const isUnassigned = !h.assignedTo;

                return (
                  <div
                    key={h.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-emerald-400">
                        {h.lead.leadCode}
                      </span>
                      {getStatusBadge(h.status, !isUnassigned)}
                    </div>

                    <div>
                      <Link
                        href={`/dashboard/leads/${h.lead.id}`}
                        className="font-bold text-sm text-white hover:text-emerald-300"
                      >
                        {h.lead.name}
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {h.lead.phone || "No phone"} • {h.lead.projectName || "Portfolio"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {getReasonBadge(h.escalationReason)}
                      <span className="text-[10px] text-slate-500 self-center">
                        {formatIST(h.createdAt)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs text-slate-300">
                      <p className="line-clamp-2">{h.summary}</p>
                      <button
                        onClick={() => setTranscriptHandoffId(h.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>View Transcript</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Owner:</span>
                        <span className="font-medium text-white">
                          {isUnassigned ? "Unassigned" : h.assignedTo?.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSalesHead ? (
                          <button
                            onClick={() => setSelectedHandoffForAssignment(h)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
                          >
                            {isUnassigned ? "Assign" : "Reassign"}
                          </button>
                        ) : (
                          h.status !== HandoffStatus.RESOLVED && (
                            <button
                              onClick={() => handleResolveHandoff(h.id, h.lead.name)}
                              className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 text-xs font-semibold"
                            >
                              Resolve
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
              <div>
                Showing{" "}
                <span className="font-semibold text-white">
                  {(pagination.page - 1) * pagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-white">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{" "}
                of <span className="font-semibold text-white">{pagination.total}</span>{" "}
                handoffs
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="px-2 font-medium text-slate-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Assignment Modal */}
      {selectedHandoffForAssignment && (
        <AssignHandoffModal
          isOpen={Boolean(selectedHandoffForAssignment)}
          onClose={() => setSelectedHandoffForAssignment(null)}
          handoff={selectedHandoffForAssignment}
          executives={metrics.eligibleExecutives}
          onAssigned={handleAssignmentComplete}
        />
      )}

      {/* Transcript Modal */}
      {transcriptHandoffId && (
        <TranscriptModal
          handoffId={transcriptHandoffId}
          onClose={() => setTranscriptHandoffId(null)}
        />
      )}
    </div>
  );
}
