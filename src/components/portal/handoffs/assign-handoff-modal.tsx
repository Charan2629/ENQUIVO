"use client";

import React, { useState } from "react";
import {
  X,
  UserCheck,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { HandoffListItem, EligibleSalesExecutive, HandoffDetail } from "@/types";

interface AssignHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  handoff: HandoffListItem | null;
  executives: EligibleSalesExecutive[];
  onAssigned: (updatedHandoff: HandoffDetail) => void;
}

export function AssignHandoffModal({
  isOpen,
  onClose,
  handoff,
  executives,
  onAssigned,
}: AssignHandoffModalProps) {
  const [selectedExecId, setSelectedExecId] = useState<string>(
    handoff?.assignedTo?.id ?? (executives[0]?.id || "")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !handoff) return null;

  const isReassignment = handoff.assignedTo !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExecId) {
      setError("Please select a Sales Executive");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/handoffs/${handoff.id}/assign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ salesExecId: selectedExecId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update handoff assignment");
      }

      onAssigned(json.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign executive");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isReassignment ? "Reassign Sales Executive" : "Assign Sales Executive"}
              </h2>
              <p className="text-[11px] text-slate-400">
                Grant ownership of buyer inquiries and chat dossier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lead Context Card */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-emerald-400">
                {handoff.lead.leadCode}
              </span>
              <span className="text-[11px] text-slate-400">
                {handoff.lead.projectName || "General Portfolio"}
              </span>
            </div>
            <div className="text-sm font-semibold text-white">
              {handoff.lead.name}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{handoff.lead.phone || "No phone"}</span>
              {handoff.lead.email && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate">{handoff.lead.email}</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800/60 mt-1">
              <span className="font-semibold text-amber-400 block text-[10px] uppercase tracking-wider mb-0.5">
                AI Escalation Summary:
              </span>
              {handoff.summary}
            </div>
          </div>

          {/* Current Assignee info if reassignment */}
          {isReassignment && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <div className="text-amber-300 font-medium">Currently Assigned To:</div>
              <div className="font-semibold text-white">
                {handoff.assignedTo?.name} ({handoff.assignedTo?.email})
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Executive Selector */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span>Select Target Sales Executive</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Ordered by lowest active workload
                </span>
              </label>

              {executives.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  No eligible Sales Executives found.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {executives.map((exec) => {
                    const isSelected = selectedExecId === exec.id;
                    const isCurrent = handoff.assignedTo?.id === exec.id;

                    return (
                      <label
                        key={exec.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="salesExec"
                            value={exec.id}
                            checked={isSelected}
                            onChange={() => setSelectedExecId(exec.id)}
                            className="w-4 h-4 text-emerald-500 border-slate-700 bg-slate-900 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-2">
                              <span>{exec.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {exec.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              exec.activeLeadCount === 0
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {exec.activeLeadCount} active {exec.activeLeadCount === 1 ? "lead" : "leads"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note on IDOR and Data Scoping */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Assigning this handoff grants this Sales Executive immediate database-scoped
                visibility over the buyer profile and historical turns in their private workspace.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || executives.length === 0}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <span>{isReassignment ? "Confirm Reassignment" : "Confirm Assignment"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
