import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffSession } from "@/lib/auth-guard";
import { leadService } from "@/services/lead/lead.service";
import { LeadSource, BookingStatus, AttendanceOutcome } from "@prisma/client";
import { LeadLifecycleStatus } from "@/types";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Tag,
  Headphones,
  Globe,
  Smartphone,
  Tv,
  Users2,
  MapPin,
  Bot,
} from "lucide-react";

export const instant = false;

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const session = await requireStaffSession();
  const { id } = await params;

  const lead = await leadService.getLeadDetail(id, session.user);

  if (!lead) {
    notFound();
  }

  // Format timestamp in Asia/Kolkata (IST)
  const formatIST = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-IN", {
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Globe className="w-3.5 h-3.5" />
            <span>Property Portal</span>
          </span>
        );
      case LeadSource.SOCIAL_MEDIA_AD:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Social Ad</span>
          </span>
        );
      case LeadSource.WEBSITE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Globe className="w-3.5 h-3.5" />
            <span>Direct Website</span>
          </span>
        );
      case LeadSource.HOARDING_CALL:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Tv className="w-3.5 h-3.5" />
            <span>Hoarding Call</span>
          </span>
        );
      case LeadSource.REFERRAL:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users2 className="w-3.5 h-3.5" />
            <span>Referral</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Other</span>
          </span>
        );
    }
  };

  const getStatusBadge = (st: LeadLifecycleStatus) => {
    switch (st) {
      case "VISITED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span>Visited (Attended)</span>
          </span>
        );
      case "BOOKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Visit Booked</span>
          </span>
        );
      case "ESCALATED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>AI Escalated</span>
          </span>
        );
      case "ENGAGED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Engaged (Chat)</span>
          </span>
        );
      case "NEW":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>New Inquiry</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Lead Pipeline</span>
        </Link>
        <span className="text-xs text-slate-500">
          Last updated: {formatIST(lead.updatedAt)}
        </span>
      </div>

      {/* Lead Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="font-mono text-sm font-bold text-emerald-400 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              {lead.leadCode}
            </span>
            {getStatusBadge(lead.status)}
            {getSourceBadge(lead.source)}
            {lead.isAnonymized && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                DPDP Anonymized
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {lead.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered on {formatIST(lead.createdAt)} • First-touch channel:{" "}
            <span className="font-semibold text-slate-300">
              {lead.source.replace(/_/g, " ")}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <div className="text-[10px] uppercase font-semibold text-slate-500">
              First Response Time
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {lead.firstResponseAt ? formatIST(lead.firstResponseAt) : "Awaiting response"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Contact Information */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-3">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Contact Information</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Phone Number</span>
              <div className="font-medium text-white flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{lead.phone || "Not provided"}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Email Address</span>
              <div className="font-medium text-white flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{lead.email || "Not provided"}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">DPDP Status</span>
              <div className="font-medium text-slate-300 mt-0.5">
                {lead.isAnonymized ? "Redacted per deletion request" : "Active Profile"}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Property Preference */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white border-b border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span>Property & Preference</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Project Interest</span>
              <div className="font-semibold text-white mt-0.5">
                {lead.project ? lead.project.name : "General Portfolio (Both Projects)"}
              </div>
              {lead.project && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>{lead.project.location}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Preferred Configuration</span>
              <div className="font-medium text-slate-200 mt-0.5">
                {lead.configuration || "Undecided / Open to options"}
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">RERA Registration</span>
              <div className="text-[11px] text-amber-400/90 font-mono mt-0.5">
                {lead.project?.reraNumber || "RERA Reg: DEMO-ONLY-NOT-VERIFIED"}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: DPDP Act 2023 Digital Consent Audit */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>DPDP Consent Audit</span>
            </div>
            {lead.consentRecord?.optedOut ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                Opted Out
              </span>
            ) : lead.consentRecord ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Affirmed
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-500">
                No Record
              </span>
            )}
          </div>

          {lead.consentRecord ? (
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Consented Timestamp</span>
                <div className="text-slate-300 font-medium mt-0.5">
                  {formatIST(lead.consentRecord.consentedAt)}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Consent Disclosure Text</span>
                <p className="mt-1 text-[11px] text-slate-400 italic bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  &ldquo;{lead.consentRecord.consentText}&rdquo;
                </p>
              </div>

              {lead.consentRecord.optedOut && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Opted out on {formatIST(lead.consentRecord.optOutAt)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No digital consent record captured for this lead profile.
            </p>
          )}
        </div>
      </div>

      {/* Multi-touch Attribution Timeline */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              Multi-Touch Attribution Journey ({lead.sourceEvents.length} touchpoints)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Immutable first-touch: {lead.source.replace(/_/g, " ")}
          </span>
        </div>

        {lead.sourceEvents.length > 0 ? (
          <div className="space-y-3">
            {lead.sourceEvents.map((event, idx) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/70"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-semibold text-slate-400 shrink-0 mt-0.5">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {getSourceBadge(event.source)}
                    {event.campaign && (
                      <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-500" />
                        <span>{event.campaign}</span>
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        First-Touch Origin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Occurred: {formatIST(event.occurredAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No attribution events logged.</p>
        )}
      </div>

      {/* Site Visits & Appointment Records */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">
              Site Visits & Appointments ({lead.siteVisits.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Attendance Outcome & Reminders
          </span>
        </div>

        {lead.siteVisits.length > 0 ? (
          <div className="space-y-4">
            {lead.siteVisits.map((visit) => {
              const isConfirmed = visit.bookingStatus === BookingStatus.CONFIRMED;
              const isCompleted = visit.bookingStatus === BookingStatus.COMPLETED;
              const isCancelled = visit.bookingStatus === BookingStatus.CANCELLED;
              const isAttended = visit.attendanceOutcome === AttendanceOutcome.ATTENDED;
              const isNoShow = visit.attendanceOutcome === AttendanceOutcome.NO_SHOW;

              return (
                <div
                  key={visit.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">
                        {formatIST(visit.slot.startsAt)} — {new Date(visit.slot.endsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isCancelled && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          Cancelled
                        </span>
                      )}
                      {isConfirmed && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Confirmed
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          Historical Visit
                        </span>
                      )}
                    </div>

                    <div>
                      {isAttended && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Attended at {formatIST(visit.attendedAt)}</span>
                        </span>
                      )}
                      {isNoShow && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>No-Show</span>
                        </span>
                      )}
                      {!isAttended && !isNoShow && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          Attendance: Unrecorded
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Appointment Location</span>
                      <div className="text-slate-300 font-medium mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{visit.slot.location}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Booked Timestamp</span>
                      <div className="text-slate-300 font-medium mt-0.5">
                        {formatIST(visit.bookedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Reminder Jobs */}
                  {visit.reminderJobs.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
                        Automated Reminders (Inngest Scheduled):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {visit.reminderJobs.map((rj) => (
                          <div
                            key={rj.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center gap-2"
                          >
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-300 font-medium">
                              {rj.reminderType === "REMINDER_24H" ? "24-Hour" : "2-Hour"}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                rj.status === "SENT"
                                  ? "text-emerald-400 bg-emerald-500/10"
                                  : rj.status === "PENDING"
                                  ? "text-blue-400 bg-blue-500/10"
                                  : "text-slate-400 bg-slate-800"
                              }`}
                            >
                              {rj.status}
                            </span>
                            <span className="text-slate-500">
                              {formatIST(rj.scheduledFor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No site visits scheduled for this lead.</p>
        )}
      </div>

      {/* Conversations & AI Chat History */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              Buyer Conversations & AI Transcripts ({lead.conversations.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Grounding facts & escalations
          </span>
        </div>

        {lead.conversations.length > 0 ? (
          <div className="space-y-6">
            {lead.conversations.map((conv, idx) => (
              <div
                key={conv.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      Conversation #{idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                      Language: {conv.language}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Started: {formatIST(conv.startedAt)}
                  </span>
                </div>

                {/* Handoff Banner if Present */}
                {conv.handoff && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2.5">
                    <Headphones className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-amber-300">
                          Escalated to Human Sales Executive:
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200">
                          {conv.handoff.status}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{conv.handoff.summary}</p>
                      <div className="text-[10px] text-slate-500">
                        Reason: {conv.handoff.escalationReason} • Assigned:{" "}
                        <strong className="text-slate-400">
                          {conv.handoff.assignedTo?.name || "Unassigned"}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages Transcript */}
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {conv.messages.map((msg) => {
                    const isUser = msg.role === "USER";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                            isUser
                              ? "bg-emerald-500/15 border border-emerald-500/30 text-white"
                              : "bg-slate-900 border border-slate-800 text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1">
                            <span className="font-semibold">
                              {isUser ? "Buyer" : "AI Concierge"}
                            </span>
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p>{msg.content}</p>
                          {!isUser && msg.groundingFactIds.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-500 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Grounded with {msg.groundingFactIds.length} verified facts</span>
                            </div>
                          )}
                        </div>
                        {isUser && (
                          <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No chat conversations recorded for this lead.</p>
        )}
      </div>
    </div>
  );
}
