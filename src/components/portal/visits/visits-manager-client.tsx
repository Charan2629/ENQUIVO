"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { UserRole, BookingStatus, AttendanceOutcome } from "@prisma/client";
import {
  CalendarCheck,
  Calendar,
  Search,
  RotateCcw,
  CheckCircle2,
  UserX,
  Loader2,
  Plus,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Building,
} from "lucide-react";
import {
  SiteVisitItem,
  SiteVisitMetrics,
  VisitSlotItem,
  VisitPagination,
} from "@/types";
import { RecordAttendanceModal } from "./record-attendance-modal";
import { CreateSlotModal } from "./create-slot-modal";
import { EditSlotModal } from "./edit-slot-modal";

interface VisitsManagerClientProps {
  userRole: UserRole;
  initialVisitMetrics: SiteVisitMetrics;
}

export function VisitsManagerClient({
  userRole,
  initialVisitMetrics,
}: VisitsManagerClientProps) {
  // Main Tab: "visits" | "slots"
  const [activeTab, setActiveTab] = useState<"visits" | "slots">("visits");

  // -------------------------------------------------------------------------
  // Visits Tab State
  // -------------------------------------------------------------------------
  const [visitSearch, setVisitSearch] = useState("");
  const [debouncedVisitSearch, setDebouncedVisitSearch] = useState("");
  const [timeframe, setTimeframe] = useState<string>("ALL");
  const [bookingStatus, setBookingStatus] = useState<string>("ALL");
  const [attendanceOutcome, setAttendanceOutcome] = useState<string>("ALL");
  const [visitPage, setVisitPage] = useState<number>(1);
  const [visitLimit] = useState<number>(20);

  const [visits, setVisits] = useState<SiteVisitItem[]>([]);
  const [visitPagination, setVisitPagination] = useState<VisitPagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [visitMetrics, setVisitMetrics] = useState<SiteVisitMetrics>(initialVisitMetrics);
  const [isVisitsLoading, setIsVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Slots Tab State
  // -------------------------------------------------------------------------
  const [slotStatus, setSlotStatus] = useState<string>("ALL");
  const [includePastSlots, setIncludePastSlots] = useState<boolean>(false);
  const [slots, setSlots] = useState<VisitSlotItem[]>([]);
  const [slotMetrics, setSlotMetrics] = useState<{
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    upcomingSlots: number;
  }>({ totalSlots: 0, availableSlots: 0, bookedSlots: 0, upcomingSlots: 0 });
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Modals State
  // -------------------------------------------------------------------------
  const [selectedVisitForAttendance, setSelectedVisitForAttendance] = useState<SiteVisitItem | null>(null);
  const [isCreateSlotOpen, setIsCreateSlotOpen] = useState(false);
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<VisitSlotItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Debounce visits search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedVisitSearch(visitSearch);
      setVisitPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [visitSearch]);

  const [refreshVisitsIndex, setRefreshVisitsIndex] = useState(0);
  const [refreshSlotsIndex, setRefreshSlotsIndex] = useState(0);

  // -------------------------------------------------------------------------
  // Data Fetching: Visits Effect
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== "visits") return;

    let cancelled = false;

    async function loadVisits() {
      setIsVisitsLoading(true);
      setVisitsError(null);
      try {
        const params = new URLSearchParams();
        if (timeframe !== "ALL") params.append("timeframe", timeframe);
        if (bookingStatus !== "ALL") params.append("bookingStatus", bookingStatus);
        if (attendanceOutcome !== "ALL") params.append("attendanceOutcome", attendanceOutcome);
        if (debouncedVisitSearch.trim()) params.append("search", debouncedVisitSearch.trim());
        params.append("page", visitPage.toString());
        params.append("limit", visitLimit.toString());

        const [resVisits, resMetrics] = await Promise.all([
          fetch(`/api/visits?${params.toString()}`),
          fetch("/api/visits/metrics"),
        ]);

        if (!resVisits.ok) {
          throw new Error("Failed to load visits");
        }
        const dataVisits = await resVisits.json();

        if (!cancelled) {
          setVisits(dataVisits.data);
          setVisitPagination(dataVisits.pagination);
        }

        if (resMetrics.ok && !cancelled) {
          const dataMetrics = await resMetrics.json();
          setVisitMetrics(dataMetrics.data);
        }
      } catch (err) {
        if (!cancelled) {
          setVisitsError(err instanceof Error ? err.message : "Failed to load visits");
        }
      } finally {
        if (!cancelled) {
          setIsVisitsLoading(false);
        }
      }
    }

    loadVisits();

    return () => {
      cancelled = true;
    };
  }, [activeTab, timeframe, bookingStatus, attendanceOutcome, debouncedVisitSearch, visitPage, visitLimit, refreshVisitsIndex]);

  // -------------------------------------------------------------------------
  // Data Fetching: Slots Effect
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== "slots") return;

    let cancelled = false;

    async function loadSlots() {
      setIsSlotsLoading(true);
      setSlotsError(null);
      try {
        const params = new URLSearchParams();
        if (slotStatus !== "ALL") params.append("status", slotStatus);
        params.append("includePast", includePastSlots ? "true" : "false");

        const [resSlots, resMetrics] = await Promise.all([
          fetch(`/api/slots?${params.toString()}`),
          fetch("/api/slots/metrics"),
        ]);

        if (!resSlots.ok) throw new Error("Failed to load appointment slots");

        const dataSlots = await resSlots.json();

        if (!cancelled) {
          setSlots(dataSlots.data);
        }

        if (resMetrics.ok && !cancelled) {
          const dataMetrics = await resMetrics.json();
          setSlotMetrics(dataMetrics.data);
        }
      } catch (err) {
        if (!cancelled) {
          setSlotsError(err instanceof Error ? err.message : "Failed to load slots");
        }
      } finally {
        if (!cancelled) {
          setIsSlotsLoading(false);
        }
      }
    }

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [activeTab, slotStatus, includePastSlots, refreshSlotsIndex]);

  const fetchVisits = useCallback(() => {
    setRefreshVisitsIndex((i) => i + 1);
  }, []);

  const fetchVisitMetrics = useCallback(() => {
    setRefreshVisitsIndex((i) => i + 1);
  }, []);

  const fetchSlots = useCallback(() => {
    setRefreshSlotsIndex((i) => i + 1);
  }, []);

  // Cancel visit handler
  const handleCancelVisit = async (visitId: string, leadName: string) => {
    if (!confirm(`Are you sure you want to cancel the site visit for "${leadName}"? This will release the slot back to available.`)) {
      return;
    }
    setActionLoadingId(visitId);
    try {
      const res = await fetch(`/api/visits/${visitId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel visit");
      }
      fetchVisits();
      fetchVisitMetrics();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete slot handler
  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this appointment slot?")) {
      return;
    }
    setActionLoadingId(slotId);
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete slot");
      }
      fetchSlots();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const isSalesHead = userRole === UserRole.SALES_HEAD;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Site Visits & Attendance</h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {isSalesHead ? "All Portfolio Visits" : "Assigned Leads Only"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage appointment schedules, verify attendance outcomes, and govern slot capacity
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setActiveTab("visits")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "visits"
                  ? "bg-purple-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Visits & Attendance
            </button>
            <button
              onClick={() => setActiveTab("slots")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "slots"
                  ? "bg-purple-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Slot Manager
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === "visits") {
                fetchVisits();
                fetchVisitMetrics();
              } else {
                fetchSlots();
              }
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh"
            aria-label="Refresh data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {activeTab === "slots" && isSalesHead && (
            <button
              onClick={() => setIsCreateSlotOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Slot
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: SITE VISITS & ATTENDANCE
          ===================================================================== */}
      {activeTab === "visits" && (
        <div className="space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-slate-400">Total Visits</div>
              <div className="text-xl font-bold text-white mt-1">{visitMetrics.totalVisits}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">All booked records</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-emerald-400">Confirmed</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{visitMetrics.confirmedCount}</div>
              <div className="text-[10px] text-emerald-400/70 mt-0.5">Active reservations</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-teal-400">Attended</div>
              <div className="text-xl font-bold text-teal-400 mt-1">{visitMetrics.attendedCount}</div>
              <div className="text-[10px] text-teal-400/70 mt-0.5">Verified visit completed</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-rose-400">No-Show</div>
              <div className="text-xl font-bold text-rose-400 mt-1">{visitMetrics.noShowCount}</div>
              <div className="text-[10px] text-rose-400/70 mt-0.5">Missed appointments</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-amber-400">Pending Review</div>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {visitMetrics.pendingAttendanceCount}
              </div>
              <div className="text-[10px] text-amber-400/70 mt-0.5">Past visits needing sign-off</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={visitSearch}
                onChange={(e) => setVisitSearch(e.target.value)}
                placeholder="Search by buyer name, phone, or lead code..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Timeframe */}
              <select
                value={timeframe}
                onChange={(e) => {
                  setTimeframe(e.target.value);
                  setVisitPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Timeframes</option>
                <option value="TODAY">Today (IST)</option>
                <option value="UPCOMING">Upcoming Visits</option>
                <option value="PAST">Past Visits</option>
              </select>

              {/* Booking Status */}
              <select
                value={bookingStatus}
                onChange={(e) => {
                  setBookingStatus(e.target.value);
                  setVisitPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Booking Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              {/* Attendance Outcome */}
              <select
                value={attendanceOutcome}
                onChange={(e) => {
                  setAttendanceOutcome(e.target.value);
                  setVisitPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Attendance Outcomes</option>
                <option value="UNRECORDED">Unrecorded</option>
                <option value="ATTENDED">Attended</option>
                <option value="NO_SHOW">No-Show</option>
              </select>
            </div>
          </div>

          {/* Visits Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {isVisitsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="text-xs">Loading site visit records...</span>
              </div>
            ) : visitsError ? (
              <div className="py-16 text-center text-rose-400 text-xs">{visitsError}</div>
            ) : visits.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-xs">
                No site visits found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Buyer & Lead</th>
                      <th className="px-4 py-3">Scheduled Time (IST)</th>
                      <th className="px-4 py-3">Venue & Project</th>
                      <th className="px-4 py-3">Assigned Sales</th>
                      <th className="px-4 py-3">Booking Status</th>
                      <th className="px-4 py-3">Attendance</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {visits.map((visit) => {
                      const isRowLoading = actionLoadingId === visit.id;

                      return (
                        <tr
                          key={visit.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Buyer & Lead */}
                          <td className="px-4 py-3.5 align-top">
                            <div className="font-semibold text-white">{visit.lead.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {visit.lead.phone || "No phone"}
                            </div>
                            <Link
                              href={`/dashboard/leads/${visit.lead.id}`}
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-purple-400 hover:text-purple-300 mt-1"
                            >
                              {visit.lead.leadCode}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          </td>

                          {/* Time */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <div className="font-medium text-slate-200">
                              {visit.startsAtIST}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {visit.isPast ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-800 text-slate-400">
                                  Past Visit
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  Upcoming
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Venue & Project */}
                          <td className="px-4 py-3.5 align-top max-w-[200px]">
                            <div className="text-slate-300 truncate">{visit.location}</div>
                            {visit.lead.projectName && (
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <Building className="w-3 h-3 shrink-0" />
                                <span className="truncate">{visit.lead.projectName}</span>
                              </div>
                            )}
                          </td>

                          {/* Assigned Salesperson */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            {visit.assignedTo ? (
                              <div className="text-slate-300 font-medium">
                                {visit.assignedTo.name}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Booking Status */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            {visit.bookingStatus === BookingStatus.CONFIRMED && (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Confirmed
                              </span>
                            )}
                            {visit.bookingStatus === BookingStatus.COMPLETED && (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Completed
                              </span>
                            )}
                            {visit.bookingStatus === BookingStatus.CANCELLED && (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-400">
                                Cancelled
                              </span>
                            )}
                          </td>

                          {/* Attendance Outcome */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            {visit.attendanceOutcome === AttendanceOutcome.ATTENDED && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Attended
                              </span>
                            )}
                            {visit.attendanceOutcome === AttendanceOutcome.NO_SHOW && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <UserX className="w-3 h-3" />
                                No-Show
                              </span>
                            )}
                            {visit.attendanceOutcome === AttendanceOutcome.UNRECORDED && (
                              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Unrecorded
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                            {isRowLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-purple-500 ml-auto" />
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Attendance Record Button */}
                                {visit.isEligibleForAttendance && (
                                  <button
                                    onClick={() => setSelectedVisitForAttendance(visit)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                                  >
                                    {visit.attendanceOutcome === AttendanceOutcome.UNRECORDED
                                      ? "Verify Attendance"
                                      : "Correct Attendance"}
                                  </button>
                                )}

                                {/* Cancellation for active confirmed visits */}
                                {visit.bookingStatus === BookingStatus.CONFIRMED && (
                                  <button
                                    onClick={() => handleCancelVisit(visit.id, visit.lead.name)}
                                    className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors text-[11px]"
                                    title="Cancel booking and release slot"
                                  >
                                    Cancel
                                  </button>
                                )}
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
            {visitPagination.total > 0 && (
              <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Showing <span className="font-semibold text-white">{visits.length}</span> of{" "}
                  <span className="font-semibold text-white">{visitPagination.total}</span> visits
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVisitPage((p) => Math.max(1, p - 1))}
                    disabled={visitPage <= 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-slate-300">
                    Page {visitPage} of {visitPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setVisitPage((p) => Math.min(visitPagination.totalPages, p + 1))}
                    disabled={visitPage >= visitPagination.totalPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: APPOINTMENT SLOT MANAGER
          ===================================================================== */}
      {activeTab === "slots" && (
        <div className="space-y-6">
          {/* Slots Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-slate-400">Total Slots</div>
              <div className="text-xl font-bold text-white mt-1">{slotMetrics.totalSlots}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Configured visit windows</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-emerald-400">Available Slots</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {slotMetrics.availableSlots}
              </div>
              <div className="text-[10px] text-emerald-400/70 mt-0.5">Upcoming & ready to book</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-purple-400">Booked Slots</div>
              <div className="text-xl font-bold text-purple-400 mt-1">{slotMetrics.bookedSlots}</div>
              <div className="text-[10px] text-purple-400/70 mt-0.5">Active or past bookings</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] font-medium text-blue-400">Upcoming Total</div>
              <div className="text-xl font-bold text-blue-400 mt-1">{slotMetrics.upcomingSlots}</div>
              <div className="text-[10px] text-blue-400/70 mt-0.5">Starts in the future</div>
            </div>
          </div>

          {/* Slots Filter Bar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <select
                value={slotStatus}
                onChange={(e) => setSlotStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Slot States</option>
                <option value="AVAILABLE">Available Only</option>
                <option value="BOOKED">Booked Only</option>
              </select>

              <label className="flex items-center gap-2 cursor-pointer text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={includePastSlots}
                  onChange={(e) => setIncludePastSlots(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-purple-500"
                />
                <span>Include Past Slots</span>
              </label>
            </div>

            <div className="text-xs text-slate-500">
              Capacity: 1 booking per slot enforced via PostgreSQL partial unique index
            </div>
          </div>

          {/* Slots Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {isSlotsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="text-xs">Loading appointment slots...</span>
              </div>
            ) : slotsError ? (
              <div className="py-16 text-center text-rose-400 text-xs">{slotsError}</div>
            ) : slots.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-xs">
                No slots match your filter selection.
              </div>
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Slot Date & Time (IST)</th>
                      <th className="px-4 py-3">Location / Venue</th>
                      <th className="px-4 py-3">Capacity & Status</th>
                      <th className="px-4 py-3">Reserved Buyer</th>
                      {isSalesHead && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {slots.map((slot) => {
                      const isSlotLoading = actionLoadingId === slot.id;

                      return (
                        <tr
                          key={slot.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Timing */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <div className="font-semibold text-white">
                              {slot.startsAtIST}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Until {slot.endsAtIST}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="px-4 py-3.5 align-top max-w-xs">
                            <div className="text-slate-300 truncate">{slot.location}</div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            {slot.status === "AVAILABLE" ? (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Available • 1 Open
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                Booked • 1/1 Reserved
                              </span>
                            )}
                          </td>

                          {/* Reserved Buyer */}
                          <td className="px-4 py-3.5 align-top">
                            {slot.activeBooking ? (
                              <div>
                                <div className="font-medium text-slate-200">
                                  {slot.activeBooking.leadName}
                                </div>
                                <Link
                                  href={`/dashboard/leads/${slot.activeBooking.leadId}`}
                                  className="font-mono text-[10px] text-purple-400 hover:text-purple-300"
                                >
                                  {slot.activeBooking.leadCode}
                                </Link>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">—</span>
                            )}
                          </td>

                          {/* Actions (Sales Head) */}
                          {isSalesHead && (
                            <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                              {isSlotLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-purple-500 ml-auto" />
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  {!slot.hasConfirmedBooking && (
                                    <>
                                      <button
                                        onClick={() => setSelectedSlotForEdit(slot)}
                                        className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
                                        title="Edit slot details"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      {slot.totalVisitsCount === 0 && (
                                        <button
                                          onClick={() => handleDeleteSlot(slot.id)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
                                          title="Delete slot"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS
          ===================================================================== */}
      {selectedVisitForAttendance && (
        <RecordAttendanceModal
          visit={selectedVisitForAttendance}
          onClose={() => setSelectedVisitForAttendance(null)}
          onSuccess={() => {
            fetchVisits();
            fetchVisitMetrics();
          }}
        />
      )}

      {isCreateSlotOpen && (
        <CreateSlotModal
          onClose={() => setIsCreateSlotOpen(false)}
          onSuccess={() => fetchSlots()}
        />
      )}

      {selectedSlotForEdit && (
        <EditSlotModal
          slot={selectedSlotForEdit}
          onClose={() => setSelectedSlotForEdit(null)}
          onSuccess={() => fetchSlots()}
        />
      )}
    </div>
  );
}
