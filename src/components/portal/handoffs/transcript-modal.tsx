"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  MessageSquare,
  Bot,
  User,
  Shield,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { HandoffDetail } from "@/types";
import { isInternalAuditMessage } from "@/lib/chat-message";

interface TranscriptModalProps {
  handoffId: string | null;
  onClose: () => void;
}

export function TranscriptModal({ handoffId, onClose }: TranscriptModalProps) {
  const [detail, setDetail] = useState<HandoffDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handoffId) return;

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/handoffs/${handoffId}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load handoff details");
        }
        if (!cancelled) {
          setDetail(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading details");
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
  }, [handoffId]);

  if (!handoffId) return null;

  const formatIST = (dateStr: Date | string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Buyer Conversation Transcript</span>
                {detail && (
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    {detail.lead.leadCode}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                {detail ? `${detail.lead.name} • Language: ${detail.conversation.language}` : "Loading conversation history..."}
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="text-xs">Loading turn-by-turn messages...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {detail && !isLoading && (
            <>
              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                    Escalation Reason: {detail.escalationReason.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-500">
                    {formatIST(detail.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-200">
                  {detail.summary}
                </p>
              </div>

              {/* Messages list */}
              <div className="space-y-3 pt-2">
                {detail.conversation.messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">
                    No chat turns recorded in this conversation session yet.
                  </p>
                ) : (
                  detail.conversation.messages.map((msg) => {
                    const isUser = msg.role === "USER";
                    const isAudit = isInternalAuditMessage(msg);

                    if (isAudit) {
                      return (
                        <div
                          key={msg.id}
                          className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 italic text-center"
                        >
                          {msg.content}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                            isUser
                              ? "bg-emerald-600 text-white rounded-tr-sm"
                              : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-sm"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>

                          <div
                            className={`mt-1.5 text-[10px] flex items-center justify-between gap-2 ${
                              isUser ? "text-emerald-200/80" : "text-slate-500"
                            }`}
                          >
                            <span>{formatIST(msg.createdAt)}</span>
                            {msg.groundingFactIds && msg.groundingFactIds.length > 0 && (
                              <span className="flex items-center gap-1 font-mono text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 border border-emerald-500/20">
                                <Shield className="w-2.5 h-2.5" />
                                <span>{msg.groundingFactIds.length} facts</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {isUser && (
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {detail && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
            <Link
              href={`/dashboard/leads/${detail.lead.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>View Full Buyer Dossier</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
