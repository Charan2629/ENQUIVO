"use client";

import React, { useState } from "react";
import { FactSheetScope, FactSheetStatus } from "@prisma/client";
import { X, Loader2, AlertCircle, FileCheck2, Info } from "lucide-react";
import { FactSheetItem } from "@/types";

interface FactSheetModalProps {
  mode: "CREATE" | "EDIT";
  fact?: FactSheetItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FactSheetModal({
  mode,
  fact,
  onClose,
  onSuccess,
}: FactSheetModalProps) {
  const [key, setKey] = useState(fact?.key ?? "");
  const [value, setValue] = useState(fact?.value ?? "");
  const [scope, setScope] = useState<FactSheetScope>(fact?.scope ?? FactSheetScope.PORTFOLIO);
  const [projectId, setProjectId] = useState(fact?.projectId ?? "");
  const [status, setStatus] = useState<FactSheetStatus>(fact?.status ?? FactSheetStatus.DRAFT);
  const [isActive, setIsActive] = useState<boolean>(fact?.isActive ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isVerified = fact?.status === FactSheetStatus.VERIFIED;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (mode === "CREATE") {
        const payload = {
          key: key.trim(),
          value: value.trim(),
          scope,
          projectId: projectId.trim() || null,
          status,
          isActive,
        };

        const res = await fetch("/api/fact-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create fact sheet entry");
        }

        onSuccess();
        onClose();
      } else {
        if (!fact) return;

        const payload = {
          key: key.trim(),
          value: value.trim(),
          scope,
          projectId: projectId.trim() || null,
          isActive,
        };

        const res = await fetch(`/api/fact-sheet/${fact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update fact sheet entry");
        }

        onSuccess();
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fact-sheet-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="fact-sheet-modal-title" className="text-base font-bold text-white">
                {mode === "CREATE" ? "Add New Property Fact" : "Edit Property Fact"}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === "CREATE"
                  ? "Define facts for AI Concierge grounding and verification"
                  : `Editing fact key: ${fact?.key}`}
              </p>
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

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === "EDIT" && isVerified && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">AI Safety Governance:</strong> Modifying content
                on this verified fact will automatically demote it to{" "}
                <span className="underline font-bold">UNVERIFIED</span> and clear approval. It will
                be excluded from Gemini context until re-approved.
              </div>
            </div>
          )}

          {/* Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Fact Key <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. portfolio.pricing_range or project1.amenities"
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Use lowercase alphanumeric characters with dots, underscores, or hyphens.
            </p>
          </div>

          {/* Scope & Project ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Grounding Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as FactSheetScope)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value={FactSheetScope.PORTFOLIO}>PORTFOLIO (All Projects)</option>
                <option value={FactSheetScope.PROJECT_1}>PROJECT_1 (Prakriti Heights)</option>
                <option value={FactSheetScope.PROJECT_2}>PROJECT_2 (Vaastu Enclave)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Project ID <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Database Project ID if project-specific"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Value */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Fact Content / Value <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Detailed factual statement retrieved by AI Concierge..."
              rows={4}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Initial Status (Create only) */}
          {mode === "CREATE" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Initial Approval Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FactSheetStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value={FactSheetStatus.DRAFT}>DRAFT (Save for review, excluded from AI)</option>
                <option value={FactSheetStatus.VERIFIED}>VERIFIED (Immediately approve & ground in AI)</option>
                <option value={FactSheetStatus.UNVERIFIED}>UNVERIFIED (Requires explicit approval)</option>
              </select>
            </div>
          )}

          {/* Active Checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="isActive" className="text-xs text-slate-300 font-medium cursor-pointer">
              Active Fact Sheet Entry{" "}
              <span className="text-slate-500 font-normal">
                (Inactive entries are suppressed from AI retrieval)
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "CREATE" ? "Create Fact" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
