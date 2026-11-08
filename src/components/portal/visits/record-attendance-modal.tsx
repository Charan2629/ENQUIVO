"use client";

import React, { useState } from "react";
import { AttendanceOutcome } from "@prisma/client";
import { X, Loader2, AlertCircle, CheckCircle2, UserX, Clock, MapPin, User } from "lucide-react";
import { SiteVisitItem } from "@/types";

interface RecordAttendanceModalProps {
  visit: SiteVisitItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordAttendanceModal({
  visit,
  onClose,
  onSuccess,
}: RecordAttendanceModalProps) {
  const [outcome, setOutcome] = useState<AttendanceOutcome>(AttendanceOutcome.ATTENDED);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/visits/${visit.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record attendance outcome");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-attendance-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="record-attendance-modal-title" className="text-base font-bold text-white">
                Record Site Visit Attendance
              </h2>
              <p className="text-xs text-slate-400">Verify attendance outcome for this appointment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Visit Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {visit.lead.name}
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {visit.lead.leadCode}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{visit.startsAtIST}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{visit.location}</span>
            </div>
          </div>

          {/* Outcome Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Attendance Outcome</label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Attended Option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  outcome === AttendanceOutcome.ATTENDED
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={AttendanceOutcome.ATTENDED}
                  checked={outcome === AttendanceOutcome.ATTENDED}
                  onChange={() => setOutcome(AttendanceOutcome.ATTENDED)}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Attended Site Visit
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Buyer arrived and completed the visit. Automatically transitions lead lifecycle
                    stage to <span className="text-emerald-400 font-semibold">VISITED</span>.
                  </p>
                </div>
              </label>

              {/* No-Show Option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  outcome === AttendanceOutcome.NO_SHOW
                    ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={AttendanceOutcome.NO_SHOW}
                  checked={outcome === AttendanceOutcome.NO_SHOW}
                  onChange={() => setOutcome(AttendanceOutcome.NO_SHOW)}
                  className="mt-0.5 text-rose-500 focus:ring-rose-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <UserX className="w-3.5 h-3.5 text-rose-400" />
                    No-Show / Did Not Attend
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Buyer did not show up. Recorded for pipeline show-up rate and attendance
                    analytics.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex items-center gap-2 px-4 py-2 font-semibold text-xs rounded-lg transition-colors disabled:opacity-50 ${
                outcome === AttendanceOutcome.ATTENDED
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {outcome === AttendanceOutcome.ATTENDED ? "Confirm Attended" : "Confirm No-Show"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
