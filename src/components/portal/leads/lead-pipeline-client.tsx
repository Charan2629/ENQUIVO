"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LeadSource, UserRole } from "@prisma/client";
import { LeadListItem, LeadLifecycleStatus, LeadPagination } from "@/types";
import {
  Search,
  RotateCcw,
  UserPlus,
  ArrowUpDown,
  Building2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Globe,
  Tv,
  Users2,
  Layers,
  HelpCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { IngestLeadModal } from "./ingest-lead-modal";

interface ProjectOption {
  id: string;
  name: string;
}

interface LeadPipelineClientProps {
  userRole: UserRole;
  userName: string;
  projects: ProjectOption[];
  initialLeads?: LeadListItem[];
  initialPagination?: LeadPagination;
}

export function LeadPipelineClient({
  userRole,
  userName,
  projects,
  initialLeads,
  initialPagination,
}: LeadPipelineClientProps) {
  // Filters & Query State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [projectId, setProjectId] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Data & State (initialized with SSR data if provided)
  const [leads, setLeads] = useState<LeadListItem[]>(initialLeads || []);
  const [pagination, setPagination] = useState<LeadPagination>(
    initialPagination || {
      total: initialLeads ? initialLeads.length : 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    }
  );
  const [isLoading, setIsLoading] = useState(!initialLeads);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track initial mount to prevent duplicate client-side fetch when SSR data is available
  const isInitialMount = React.useRef(true);
  const initialLeadsRef = React.useRef(initialLeads);

  // Modal State
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Synchronize leads from API
  useEffect(() => {
    // If SSR data was provided, bypass duplicate initial mount fetch
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialLeadsRef.current) {
        return;
      }
    }

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
        if (source !== "ALL") {
          params.set("source", source);
        }
        if (projectId !== "ALL") {
          params.set("projectId", projectId);
        }

        const res = await fetch(`/api/leads?${params.toString()}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch leads (${res.status})`);
        }

        const json = await res.json();
        if (!cancelled) {
          setLeads(json.data || []);
          setPagination(
            json.pagination || {
              total: 0,
              page: 1,
              limit,
              totalPages: 1,
            }
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading lead pipeline");
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
  }, [page, limit, debouncedSearch, status, source, projectId, sortBy, sortOrder, refreshKey]);

  // Trigger manual refresh
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("ALL");
    setSource("ALL");
    setProjectId("ALL");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const isFiltered =
    debouncedSearch.trim() !== "" ||
    status !== "ALL" ||
    source !== "ALL" ||
    projectId !== "ALL";

  // Helpers for formatting
  const formatIST = (dateStr: Date | string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSourceBadge = (src: LeadSource) => {
    switch (src) {
      case LeadSource.PROPERTY_PORTAL:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Globe className="w-3 h-3" />
            <span>Property Portal</span>
          </span>
        );
      case LeadSource.SOCIAL_MEDIA_AD:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Smartphone className="w-3 h-3" />
            <span>Social Ad</span>
          </span>
        );
      case LeadSource.WEBSITE:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Globe className="w-3 h-3" />
            <span>Direct Website</span>
          </span>
        );
      case LeadSource.HOARDING_CALL:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Tv className="w-3 h-3" />
            <span>Hoarding Call</span>
          </span>
        );
      case LeadSource.REFERRAL:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users2 className="w-3 h-3" />
            <span>Referral</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3 h-3" />
            <span>Other</span>
          </span>
        );
    }
  };

  const getStatusBadge = (st: LeadLifecycleStatus) => {
    switch (st) {
      case "VISITED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span>Visited (Attended)</span>
          </span>
        );
      case "BOOKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Visit Booked</span>
          </span>
        );
      case "ESCALATED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Escalated Handoff</span>
          </span>
        );
      case "ENGAGED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>Engaged (Chat)</span>
          </span>
        );
      case "NEW":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>New Inquiry</span>
          </span>
        );
    }
  };

  const statusPills: Array<{ label: string; value: string }> = [
    { label: "All Leads", value: "ALL" },
    { label: "New", value: "NEW" },
    { label: "Engaged", value: "ENGAGED" },
    { label: "Escalated", value: "ESCALATED" },
    { label: "Booked", value: "BOOKED" },
    { label: "Visited", value: "VISITED" },
  ];

  return (
    <div className="space-y-5">
      {/* Search, Action & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Top Controls: Search + Ingest Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or lead code..."
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

          <div className="flex items-center gap-2 self-end md:self-auto">
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            {userRole === UserRole.SALES_HEAD ? (
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Ingest Lead</span>
              </button>
            ) : (
              <div
                title="Lead intake and distribution are administered by the Sales Head (Milestone 6.3)"
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-500 text-xs font-medium flex items-center gap-1.5 cursor-not-allowed select-none"
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-600" />
                <span>Assigned Leads Only</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusPills.map((pill) => {
            const isActive = status === pill.value;
            return (
              <button
                key={pill.value}
                onClick={() => {
                  setStatus(pill.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-emerald-500 text-slate-950 font-semibold shadow-md shadow-emerald-500/20"
                    : "bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown Filters (Source, Project, Sort) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          {/* Source Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Acquisition Source
            </label>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="ALL">All Sources</option>
              <option value={LeadSource.PROPERTY_PORTAL}>Property Portal</option>
              <option value={LeadSource.SOCIAL_MEDIA_AD}>Social Media Ad</option>
              <option value={LeadSource.WEBSITE}>Direct Website</option>
              <option value={LeadSource.HOARDING_CALL}>Hoarding Call</option>
              <option value={LeadSource.REFERRAL}>Referral</option>
              <option value={LeadSource.OTHER}>Other / Walk-in</option>
            </select>
          </div>

          {/* Project Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Project Preference
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Sort By
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="createdAt">Created Date</option>
                <option value="name">Buyer Name</option>
                <option value="leadCode">Lead Code</option>
                <option value="firstResponseAt">First Response</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                title={`Order: ${sortOrder.toUpperCase()}`}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Page Limit */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Page Size
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Role Scoping Notice */}
      {userRole === UserRole.SALES_EXEC && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Executive Scope Active:</strong> Viewing leads assigned directly to {userName}. Unassigned leads are queued in Handoffs.
            </span>
          </div>
          <span className="text-[10px] uppercase font-semibold bg-blue-500/20 px-2 py-0.5 rounded text-blue-200">
            SALES_EXEC
          </span>
        </div>
      )}

      {/* Leads Table Container */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading lead pipeline records...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Error Loading Leads</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">{error}</p>
            <button
              onClick={triggerRefresh}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Retry Request
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && leads.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No Leads Found</h3>
            {isFiltered ? (
              <div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  No leads match your current search and filter combination.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : userRole === UserRole.SALES_EXEC ? (
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                You do not currently have any buyer leads assigned to you. Leads will appear here once assigned to you via the Handoff Queue by the Sales Head (Milestone 6.3).
              </p>
            ) : (
              <div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  The lead pipeline is currently empty. Record a new lead to start.
                </p>
                <button
                  onClick={() => setIsIngestModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  + Ingest First Lead
                </button>
              </div>
            )}
          </div>
        )}

        {/* Desktop Data Table */}
        {!isLoading && !error && leads.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto min-w-0">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Lead Code</th>
                    <th className="py-3.5 px-4">Buyer Details</th>
                    <th className="py-3.5 px-4">First-Touch Channel</th>
                    <th className="py-3.5 px-4">Project & Config</th>
                    <th className="py-3.5 px-4">Lifecycle Status</th>
                    <th className="py-3.5 px-4">First Response</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Lead Code */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="hover:text-emerald-400 transition-colors"
                        >
                          {lead.leadCode}
                        </Link>
                      </td>

                      {/* Buyer Details */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">
                          <Link
                            href={`/dashboard/leads/${lead.id}`}
                            className="hover:text-emerald-300 transition-colors"
                          >
                            {lead.name}
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{lead.phone || "No phone"}</span>
                          {lead.email && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="truncate max-w-[140px]">{lead.email}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* First-Touch Channel */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getSourceBadge(lead.source)}
                          {lead.touchpointCount > 1 && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {lead.touchpointCount} touchpoints
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Project & Config */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-300 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{lead.projectName || "General Portfolio"}</span>
                        </div>
                        {lead.configuration && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {lead.configuration}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">{getStatusBadge(lead.status)}</td>

                      {/* First Response */}
                      <td className="py-3 px-4 text-slate-400">
                        {lead.firstResponseAt ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{formatIST(lead.firstResponseAt)}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600 italic">
                            Awaiting response
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-colors"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< md) */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-emerald-400">
                      {lead.leadCode}
                    </span>
                    {getStatusBadge(lead.status)}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">{lead.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {lead.phone || "No phone"}{lead.email ? ` • ${lead.email}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {getSourceBadge(lead.source)}
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">
                      {lead.projectName || "General Portfolio"}
                    </span>
                    {lead.configuration && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">{lead.configuration}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    <span className="text-slate-500">
                      Created: {formatIST(lead.createdAt)}
                    </span>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="text-emerald-400 font-semibold flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                Showing{" "}
                <span className="font-semibold text-white">
                  {leads.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-white">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{" "}
                of <span className="font-semibold text-white">{pagination.total}</span> leads
              </div>

              <div className="flex items-center gap-2 self-center sm:self-auto">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
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
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
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

      {/* Manual Ingest Modal */}
      <IngestLeadModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onSuccess={triggerRefresh}
        projects={projects}
      />
    </div>
  );
}
