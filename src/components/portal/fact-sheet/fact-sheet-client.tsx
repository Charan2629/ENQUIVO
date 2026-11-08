"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileCheck2,
  Plus,
  Search,
  RotateCcw,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  Sparkles,
} from "lucide-react";
import { FactSheetScope, FactSheetStatus } from "@prisma/client";
import { FactSheetItem, FactSheetMetrics } from "@/types";
import { FactSheetModal } from "./fact-sheet-modal";

interface FactSheetClientProps {
  initialMetrics: FactSheetMetrics;
}

export function FactSheetClient({ initialMetrics }: FactSheetClientProps) {
  // Query Filters & State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scope, setScope] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [isActive, setIsActive] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);

  // Data & Metrics State
  const [facts, setFacts] = useState<FactSheetItem[]>([]);
  const [metrics, setMetrics] = useState<FactSheetMetrics>(initialMetrics);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [selectedFact, setSelectedFact] = useState<FactSheetItem | null>(null);

  // Action Loading State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load facts and metrics inside effect
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (scope !== "ALL") params.append("scope", scope);
        if (status !== "ALL") params.append("status", status);
        if (isActive !== "ALL") params.append("isActive", isActive);
        if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
        params.append("page", page.toString());
        params.append("limit", limit.toString());

        const [resFacts, resMetrics] = await Promise.all([
          fetch(`/api/fact-sheet?${params.toString()}`),
          fetch("/api/fact-sheet/metrics"),
        ]);

        if (!resFacts.ok) {
          throw new Error("Failed to load fact sheets");
        }
        const dataFacts = await resFacts.json();

        if (!cancelled) {
          setFacts(dataFacts.data);
          setTotalPages(dataFacts.pagination.totalPages);
          setTotalCount(dataFacts.pagination.total);
        }

        if (resMetrics.ok && !cancelled) {
          const dataMetrics = await resMetrics.json();
          setMetrics(dataMetrics.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load facts");
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
  }, [scope, status, isActive, debouncedSearch, page, limit, refreshIndex]);

  const handleRefresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // Verify / Reject handler
  const handleVerify = async (id: string, action: "VERIFY" | "REJECT") => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/fact-sheet/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }
      handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete handler
  const handleDelete = async (id: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete fact "${keyName}"? This action cannot be undone.`)) {
      return;
    }
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/fact-sheet/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getScopeBadge = (factScope: FactSheetScope) => {
    switch (factScope) {
      case FactSheetScope.PORTFOLIO:
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Portfolio
          </span>
        );
      case FactSheetScope.PROJECT_1:
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Project 1
          </span>
        );
      case FactSheetScope.PROJECT_2:
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Project 2
          </span>
        );
    }
  };

  const getStatusBadge = (factStatus: FactSheetStatus, active: boolean) => {
    if (!active) {
      return (
        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          Inactive
        </span>
      );
    }
    switch (factStatus) {
      case FactSheetStatus.VERIFIED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            Verified • AI Active
          </span>
        );
      case FactSheetStatus.DRAFT:
        return (
          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Draft
          </span>
        );
      case FactSheetStatus.UNVERIFIED:
        return (
          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Unverified
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <p className="text-xs text-slate-400">
              Govern verified property facts and AI Concierge grounding scope
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh facts"
            aria-label="Refresh facts"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedFact(null);
              setModalMode("CREATE");
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Property Fact
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Total Facts</span>
            <Database className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalFacts}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total property facts configured</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-medium">AI Grounded Facts</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metrics.verifiedActive}</div>
          <div className="text-[11px] text-emerald-400/70 mt-1">Verified & Active in Gemini context</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-xs font-medium">Draft Entries</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{metrics.draftCount}</div>
          <div className="text-[11px] text-amber-400/70 mt-1">Pending approval (Excluded from AI)</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="text-xs font-medium">Unverified / Inactive</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {metrics.unverifiedCount + metrics.inactiveCount}
          </div>
          <div className="text-[11px] text-rose-400/70 mt-1">Requires review or deactivated</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key name or content..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Scope Filter */}
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Scopes</option>
            <option value={FactSheetScope.PORTFOLIO}>Portfolio</option>
            <option value={FactSheetScope.PROJECT_1}>Project 1</option>
            <option value={FactSheetScope.PROJECT_2}>Project 2</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value={FactSheetStatus.VERIFIED}>Verified Only</option>
            <option value={FactSheetStatus.DRAFT}>Drafts Only</option>
            <option value={FactSheetStatus.UNVERIFIED}>Unverified Only</option>
          </select>

          {/* Active Filter */}
          <select
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">Active & Inactive</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Facts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Loading fact sheet entries...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-400 text-xs">{error}</div>
        ) : facts.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            No fact sheet entries match your search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Fact Key & Scope</th>
                  <th className="px-4 py-3">Content / Value</th>
                  <th className="px-4 py-3">Governance Status</th>
                  <th className="px-4 py-3">Audit Details</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {facts.map((fact) => {
                  const isRowActionLoading = actionLoadingId === fact.id;

                  return (
                    <tr
                      key={fact.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Key & Scope */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-mono text-xs font-semibold text-white">
                          {fact.key}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {getScopeBadge(fact.scope)}
                          {fact.projectName && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {fact.projectName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Content / Value */}
                      <td className="px-4 py-3.5 align-top max-w-md">
                        <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                          {fact.value}
                        </p>
                      </td>

                      {/* Governance Status */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="space-y-1">
                          {getStatusBadge(fact.status, fact.isActive)}
                          {fact.verifiedBy && (
                            <div className="text-[10px] text-emerald-400/80">
                              By {fact.verifiedBy.name}
                            </div>
                          )}
                          {!fact.verifiedBy && fact.status !== FactSheetStatus.VERIFIED && (
                            <div className="text-[10px] text-slate-500">
                              Requires human sign-off
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Audit Details */}
                      <td className="px-4 py-3.5 align-top text-slate-400 text-[11px] whitespace-nowrap">
                        <div>Created by: {fact.createdBy.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(fact.updatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        {isRowActionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500 ml-auto" />
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Verify / Approve Action */}
                            {fact.status !== FactSheetStatus.VERIFIED ? (
                              <button
                                onClick={() => handleVerify(fact.id, "VERIFY")}
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                                title="Approve and ground in AI"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVerify(fact.id, "REJECT")}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                                title="Revoke verification (demote to Unverified)"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit Action */}
                            <button
                              onClick={() => {
                                setSelectedFact(fact);
                                setModalMode("EDIT");
                              }}
                              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
                              title="Edit fact details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Action */}
                            <button
                              onClick={() => handleDelete(fact.id, fact.key)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
                              title="Delete fact entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{facts.length}</span> of{" "}
              <span className="font-semibold text-white">{totalCount}</span> facts
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <FactSheetModal
          mode={modalMode}
          fact={selectedFact}
          onClose={() => {
            setModalMode(null);
            setSelectedFact(null);
          }}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
