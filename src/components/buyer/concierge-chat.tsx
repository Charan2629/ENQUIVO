"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  ShieldCheck,
  User,
  Bot,
  UserCheck,
  PhoneOff,
  LogOut,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { filterBuyerFacingMessages } from "@/lib/chat-message";
import {
  CONCIERGE_TRANSLATIONS,
  type Language,
} from "@/lib/i18n/concierge-translations";

interface Message {
  id: string;
  role: "USER" | "AI";
  content: string;
  groundingFactIds?: string[];
  createdAt: string;
}

interface HandoffInfo {
  status: string;
  escalationReason: string;
  summary: string;
  assignedToName: string;
}

export interface ConciergeChatProps {
  initialProjectId?: string | null;
  className?: string;
  compact?: boolean;
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
}

export function ConciergeChat({
  initialProjectId,
  className = "",
  compact = false,
  language: propLanguage,
  onLanguageChange,
}: ConciergeChatProps) {
  // Session State
  const [loadingSession, setLoadingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [internalLanguage, setInternalLanguage] = useState<Language>(propLanguage || "EN");

  const onLanguageChangeRef = useRef(onLanguageChange);
  useEffect(() => {
    onLanguageChangeRef.current = onLanguageChange;
  });

  const language = propLanguage || internalLanguage;

  const handleLanguageChange = (lang: Language) => {
    setInternalLanguage(lang);
    onLanguageChange?.(lang);
  };

  // Translation Dictionary
  const t = CONCIERGE_TRANSLATIONS[language];

  // Intake Form State
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formProject, setFormProject] = useState(initialProjectId || "");
  const [formConsent, setFormConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<{
    text: string;
    clientMessageId: string;
  } | null>(null);
  const [handoff, setHandoff] = useState<HandoffInfo | null>(null);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [isOptingOut, setIsOptingOut] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Check existing session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        setLoadingSession(true);
        const res = await fetch("/api/chat/session", {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setAuthenticated(true);
            setBuyerName(data.lead?.name || "Valued Buyer");
            const sessionLang: Language =
              data.conversation?.language === "HI" ||
              data.conversation?.language === "GU"
                ? data.conversation.language
                : "EN";
            setInternalLanguage(sessionLang);
            onLanguageChangeRef.current?.(sessionLang);
            if (data.messages && data.messages.length > 0) {
              setMessages(data.messages);
            } else {
              const welcomeText = getWelcomeGreeting(sessionLang, data.lead?.name || "Valued Buyer");
              setMessages([
                {
                  id: "welcome-greeting",
                  role: "AI",
                  content: welcomeText,
                  createdAt: new Date().toISOString(),
                },
              ]);
            }
            if (data.handoff) {
              setHandoff(data.handoff);
            }
          } else {
            setAuthenticated(false);
          }
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setAuthenticated(false);
      } finally {
        setLoadingSession(false);
      }
    }

    checkSession();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // 2. Handle Intake Form Submission
  async function handleStartSession(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError(t.nameRequiredError);
      return;
    }
    if (!formPhone.trim()) {
      setFormError(t.phoneRequiredError);
      return;
    }
    if (!formConsent) {
      setFormError(t.dpdpConsentRequiredError);
      return;
    }

    try {
      setIsSubmittingForm(true);
      const res = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim() || null,
          language,
          projectId: formProject || null,
          consentText: t.dpdpConsentLabel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to start concierge session.");
        return;
      }

      setAuthenticated(true);
      setBuyerName(data.lead?.name || formName);
      if (
        data.conversation?.language === "EN" ||
        data.conversation?.language === "HI" ||
        data.conversation?.language === "GU"
      ) {
        setInternalLanguage(data.conversation.language);
        onLanguageChange?.(data.conversation.language);
      }

      // Load existing conversation messages if resumed, or add welcoming introductory greeting
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        const welcomeText = getWelcomeGreeting(language, data.lead?.name || formName);
        setMessages([
          {
            id: "welcome-greeting",
            role: "AI",
            content: welcomeText,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.networkError);
    } finally {
      setIsSubmittingForm(false);
    }
  }

  // 3. Handle Sending a Chat Message (with clientMessageId for request-level idempotency)
  async function handleSendMessage(
    overrideMessage?: string,
    isRetry = false,
    retryClientMessageId?: string
  ) {
    if (isSending) return;
    const textToSend = (overrideMessage || inputMessage).trim();
    if (!textToSend) return;

    // Generate clientMessageId for new messages, or preserve on retry
    const clientMessageId =
      isRetry && retryClientMessageId
        ? retryClientMessageId
        : `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!isRetry) {
      setInputMessage("");
      // Optimistically append user message to UI only on new turns
      const userTurn: Message = {
        id: clientMessageId,
        role: "USER",
        content: textToSend,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userTurn]);
    }

    setChatError(null);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, clientMessageId, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLastFailedMessage({ text: textToSend, clientMessageId });
        if (res.status === 401 || res.status === 403) {
          setChatError(data.error || t.sessionEndedError);
          setAuthenticated(false);
          return;
        }
        setChatError(data.error || t.temporaryHighDemandError);
        return;
      }

      // Success: clear failed message
      setLastFailedMessage(null);

      // Append assistant reply
      const aiTurn: Message = {
        id: data.aiMessage.id,
        role: "AI",
        content: data.aiMessage.content,
        groundingFactIds: data.groundingFactIds,
        createdAt: data.aiMessage.createdAt,
      };

      setMessages((prev) => [...prev, aiTurn]);

      if (data.handoffCreated && data.handoff) {
        setHandoff({
          status: data.handoff.status,
          escalationReason: data.handoff.escalationReason,
          summary: data.handoff.summary,
          assignedToName: "Senior Sales Executive",
        });
      }
    } catch (err) {
      setLastFailedMessage({ text: textToSend, clientMessageId });
      setChatError(
        err instanceof Error && err.message ? t.networkError : "Network error. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  // 3b. Retry Last Failed Message (reuses exact clientMessageId)
  function handleRetry() {
    if (!lastFailedMessage || isSending) return;
    handleSendMessage(lastFailedMessage.text, true, lastFailedMessage.clientMessageId);
  }

  // 4. Request Human Salesperson (Direct offline route: 100% reliable even during AI provider outages)
  async function handleRequestHuman() {
    if (isSending) return;

    const requestText =
      language === "HI"
        ? "कृपया मुझे एक वरिष्ठ बिक्री कार्यकारी से जोड़ें।"
        : language === "GU"
        ? "કૃપા કરીને મને વરિષ્ઠ સેલ્સ એક્ઝિક્યુટિવ સાથે જોડો."
        : "I would like to speak directly with a human sales executive regarding my property requirements.";

    // Optimistically show user request
    const tempId = `cmsg_${Date.now()}_req_human`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "USER",
        content: requestText,
        createdAt: new Date().toISOString(),
      },
    ]);

    setChatError(null);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setChatError(data.error || t.sessionEndedError);
          setAuthenticated(false);
          return;
        }
        setChatError(data.error || t.humanConnectionError);
        return;
      }

      // Append assistant confirmation
      if (data.aiMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.aiMessage.id,
            role: "AI",
            content: data.aiMessage.content,
            groundingFactIds: [],
            createdAt: data.aiMessage.createdAt,
          },
        ]);
      }

      if (data.handoff) {
        setHandoff({
          status: data.handoff.status,
          escalationReason: data.handoff.escalationReason,
          summary: data.handoff.summary,
          assignedToName: data.assignedToName || "Senior Sales Executive",
        });
      }
    } catch (err) {
      setChatError(
        err instanceof Error && err.message ? t.networkError : "Network error. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  // 5. End Conversation / Revoke Session
  async function handleEndSession() {
    try {
      await fetch("/api/chat/session", { method: "DELETE" });
      setAuthenticated(false);
      setMessages([]);
      setHandoff(null);
    } catch (err) {
      console.error("Failed to end session:", err);
      setAuthenticated(false);
    }
  }

  // 6. DPDP Opt-Out
  async function handleOptOut() {
    try {
      setIsOptingOut(true);
      await fetch("/api/chat/session/opt-out", { method: "POST" });
      setAuthenticated(false);
      setMessages([]);
      setHandoff(null);
      setShowOptOutConfirm(false);
      alert(t.optOutSuccessAlert);
    } catch (err) {
      console.error("Failed to opt out:", err);
      alert(t.optOutFailureAlert);
    } finally {
      setIsOptingOut(false);
    }
  }

  // Loading Session Skeleton
  if (loadingSession) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-8 rounded-2xl bg-white border border-[#102F43]/10 text-[#102F43] min-h-[420px] shadow-[0_4px_20px_-2px_rgba(16,47,67,0.08)] ${className}`}
      >
        <RefreshCw className="h-6 w-6 animate-spin text-[#13A99A] mb-3" />
        <p className="text-xs uppercase tracking-wider text-[#102F43]/70 font-semibold">
          {t.startingSessionButton}
        </p>
      </div>
    );
  }

  // State 1: Intake & Digital Consent Form
  if (!authenticated) {
    return (
      <div
        className={`rounded-2xl border border-[#102F43]/15 bg-white p-6 sm:p-8 text-[#102F43] shadow-[0_10px_35px_-5px_rgba(16,47,67,0.08)] ${className}`}
      >
        {/* Form Header with Language Switcher */}
        <div className="flex items-center justify-between pb-4 border-b border-[#102F43]/10 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#13A99A] animate-pulse" />
            <h3 className="font-serif text-base sm:text-lg font-semibold text-[#102F43] tracking-wide truncate">
              {t.intakeTitle}
            </h3>
          </div>
          <div className="flex items-center rounded-lg bg-[#F7F8F4] p-1 border border-[#102F43]/15 shrink-0 text-xs">
            {(["EN", "HI", "GU"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleLanguageChange(lang)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  language === lang
                    ? "bg-[#102F43] text-white shadow-xs"
                    : "text-[#102F43]/70 hover:text-[#102F43] hover:bg-[#E7F4F4]"
                }`}
              >
                <span className="hidden sm:inline">
                  {lang === "EN" ? "English" : lang === "HI" ? "हिन्दी" : "ગુજરાતી"}
                </span>
                <span className="sm:hidden">{lang}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs sm:text-sm text-[#102F43]/80 leading-relaxed">
          {t.intakeSubtitle}
        </p>

        {formError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-rose-800 text-xs shadow-2xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        <form onSubmit={handleStartSession} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#102F43] mb-1.5">
              {t.nameLabel} <span className="text-[#13A99A]">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t.namePlaceholder}
              className="w-full rounded-xl bg-[#F7F8F4] px-3.5 py-2.5 text-xs sm:text-sm text-[#102F43] placeholder-[#102F43]/40 border border-[#102F43]/15 focus:border-[#13A99A] focus:outline-hidden focus:ring-1 focus:ring-[#13A99A] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102F43] mb-1.5">
              {t.phoneLabel} <span className="text-[#13A99A]">*</span>
            </label>
            <input
              type="tel"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full rounded-xl bg-[#F7F8F4] px-3.5 py-2.5 text-xs sm:text-sm text-[#102F43] placeholder-[#102F43]/40 border border-[#102F43]/15 focus:border-[#13A99A] focus:outline-hidden focus:ring-1 focus:ring-[#13A99A] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102F43] mb-1.5">
              {t.emailLabel}{" "}
              <span className="text-[#102F43]/50 font-normal">{t.emailOptional}</span>
            </label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="w-full rounded-xl bg-[#F7F8F4] px-3.5 py-2.5 text-xs sm:text-sm text-[#102F43] placeholder-[#102F43]/40 border border-[#102F43]/15 focus:border-[#13A99A] focus:outline-hidden focus:ring-1 focus:ring-[#13A99A] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102F43] mb-1.5">
              {t.projectInterestLabel}
            </label>
            <select
              value={formProject}
              onChange={(e) => setFormProject(e.target.value)}
              className="w-full rounded-xl bg-[#F7F8F4] px-3 py-2.5 text-xs sm:text-sm text-[#102F43] border border-[#102F43]/15 focus:border-[#13A99A] focus:outline-hidden focus:ring-1 focus:ring-[#13A99A] transition-colors cursor-pointer"
            >
              <option value="">{t.projectAllOption}</option>
              <option value="proj_prakriti_heights">{t.projectPrakritiOption}</option>
              <option value="proj_vaastu_enclave">{t.projectVaastuOption}</option>
            </select>
          </div>

          {/* DPDP Act 2023 Digital Consent Affirmation */}
          <div className="rounded-xl bg-[#E7F4F4]/70 p-3.5 border border-[#13A99A]/30">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formConsent}
                onChange={(e) => setFormConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#102F43]/30 bg-white text-[#13A99A] focus:ring-[#13A99A] cursor-pointer"
              />
              <span className="text-[11px] leading-relaxed text-[#102F43]/85">
                {t.dpdpConsentLabel}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmittingForm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#13A99A] hover:bg-[#0f8c80] px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-md focus:outline-hidden transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmittingForm ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>{t.startingSessionButton}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{t.startSessionButton}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#102F43]/70 font-medium">
          <Lock className="h-3.5 w-3.5 text-[#13A99A]" />
          <span>{t.privacySignedNotice}</span>
        </div>
      </div>
    );
  }

  // State 2: Active Authenticated Chat Experience
  return (
    <div
      className={`flex flex-col rounded-2xl border border-[#102F43]/15 bg-white text-[#102F43] shadow-[0_15px_40px_-5px_rgba(16,47,67,0.12)] overflow-hidden ${
        compact ? "h-[500px]" : "h-[580px] sm:h-[650px] lg:h-[680px]"
      } ${className}`}
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#183442] bg-[#102F43] text-white gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E7F4F4]/15 text-[#38C2B4] border border-[#13A99A]/40">
              <Bot className="h-4 w-4" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#13A99A] ring-2 ring-[#102F43] animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="font-serif text-xs sm:text-sm font-semibold text-white tracking-wide truncate">
                ENQUIVO Concierge
              </h3>
              <span className="shrink-0 text-[9px] sm:text-[10px] font-semibold text-[#38C2B4] uppercase tracking-wider bg-[#13A99A]/20 px-2 py-0.5 rounded border border-[#13A99A]/30">
                {t.groundedStatusBadge}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-white/70 truncate">
              {buyerName ? t.activeConsultationWith(buyerName) : t.verifiedAssistantSubtitle}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Language Toggle */}
          <div className="flex items-center rounded-lg bg-white/10 p-0.5 border border-white/15 text-xs">
            {(["EN", "HI", "GU"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleLanguageChange(lang)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  language === lang
                    ? "bg-[#D6B56D] text-[#102F43] font-bold shadow-2xs"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Request Human Button */}
          <button
            type="button"
            disabled={isSending}
            onClick={handleRequestHuman}
            title={t.requestHumanTitle}
            aria-label={t.requestHumanTitle}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 sm:px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 transition-colors disabled:opacity-40 cursor-pointer shrink-0 border border-white/10"
          >
            <UserCheck className="h-3.5 w-3.5 text-[#D6B56D] shrink-0" />
            <span className="hidden md:inline">{t.requestHumanButton}</span>
          </button>

          {/* End / Opt-Out Menu */}
          <button
            type="button"
            onClick={() => setShowOptOutConfirm(true)}
            title="End session or manage privacy"
            aria-label="End session"
            className="p-1.5 rounded-lg text-white/70 hover:text-rose-300 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Human Handoff Banner (if escalated) */}
      {handoff && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 bg-[#E7F4F4] border-b border-[#13A99A]/30 text-[#102F43] text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#13A99A] mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">
              {t.connectedWithHumanBanner(handoff.assignedToName, handoff.summary, handoff.status)}
            </span>
          </div>
        </div>
      )}

      {/* Message History Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-4.5 text-xs sm:text-[13px] bg-[#F7F8F4]">
        {filterBuyerFacingMessages(messages).map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 sm:gap-3 ${
              m.role === "USER" ? "justify-end" : "justify-start"
            }`}
          >
            {m.role === "AI" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E7F4F4] text-[#13A99A] border border-[#13A99A]/30 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-4.5 sm:py-3.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                m.role === "USER"
                  ? "bg-[#102F43] text-white font-medium rounded-tr-xs"
                  : "bg-white text-[#102F43] rounded-tl-xs border border-[#102F43]/10"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Verified Grounding Badge */}
              {m.role === "AI" && m.groundingFactIds && m.groundingFactIds.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#102F43]/10 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#0D7A6F] font-semibold bg-[#E7F4F4]/60 px-2 py-1 rounded-md">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#13A99A] shrink-0" />
                  <span>{t.groundedFactsBadge(m.groundingFactIds.length)}</span>
                </div>
              )}
            </div>

            {m.role === "USER" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#102F43] text-white border border-[#102F43]/30 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Loading / Typing Indicator */}
        {isSending && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E7F4F4] text-[#13A99A] border border-[#13A99A]/30">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white px-4 py-3 border border-[#102F43]/10 shadow-2xs">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#13A99A] animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#13A99A] animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#13A99A] animate-bounce [animation-delay:0.4s]" />
                <span className="ml-2 text-[11px] text-[#102F43]/70 font-medium">
                  {t.consultingDatabaseIndicator}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert with Working Retry and Human Escalation Fallback */}
        {chatError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-rose-50 p-3.5 border border-rose-200 text-rose-800 text-xs shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed font-medium">{chatError}</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {lastFailedMessage && (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isSending ? "animate-spin" : ""}`} />
                  <span>{t.retryButton}</span>
                </button>
              )}
              <button
                type="button"
                disabled={isSending}
                onClick={handleRequestHuman}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-[11px] font-semibold text-[#102F43] border border-[#102F43]/20 hover:bg-[#E7F4F4] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <UserCheck className="h-3 w-3 text-[#13A99A]" />
                <span>{t.talkToSalesButton}</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Inquiries */}
      {messages.length <= 2 && (
        <div className="px-4 py-2.5 border-t border-[#102F43]/10 bg-white flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-[10px] text-[#102F43]/60 uppercase tracking-wider font-bold shrink-0">
            {t.quickQuestionsTitle}:
          </span>
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage(t.quickQuestion1)}
            className="shrink-0 rounded-full bg-[#F7F8F4] px-3 py-1 text-[#102F43] hover:bg-[#E7F4F4] border border-[#102F43]/15 hover:border-[#13A99A] disabled:opacity-40 transition-colors font-medium cursor-pointer"
          >
            {t.quickQuestion1}
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage(t.quickQuestion2)}
            className="shrink-0 rounded-full bg-[#F7F8F4] px-3 py-1 text-[#102F43] hover:bg-[#E7F4F4] border border-[#102F43]/15 hover:border-[#13A99A] disabled:opacity-40 transition-colors font-medium cursor-pointer"
          >
            {t.quickQuestion2}
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage(t.quickQuestion3)}
            className="shrink-0 rounded-full bg-[#F7F8F4] px-3 py-1 text-[#102F43] hover:bg-[#E7F4F4] border border-[#102F43]/15 hover:border-[#13A99A] disabled:opacity-40 transition-colors font-medium cursor-pointer"
          >
            {t.quickQuestion3}
          </button>
        </div>
      )}

      {/* Message Composer */}
      <div className="p-3 sm:p-4 border-t border-[#102F43]/10 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isSending) return;
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            placeholder={t.inputPlaceholder}
            className="flex-1 rounded-xl bg-[#F7F8F4] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-[#102F43] placeholder-[#102F43]/40 border border-[#102F43]/15 focus:border-[#13A99A] focus:outline-hidden focus:ring-1 focus:ring-[#13A99A] disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            aria-label={t.sendMessageAria}
            className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-[#13A99A] hover:bg-[#0f8c80] text-white disabled:opacity-40 transition-colors focus:outline-hidden cursor-pointer shadow-xs"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Regulatory & Privacy Notice */}
        <div className="mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-[10px] text-[#102F43]/70 text-center sm:text-left font-medium">
          <span>{t.reraRegBadge}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEndSession}
              className="text-[#102F43]/70 hover:text-[#102F43] underline cursor-pointer"
            >
              {t.endSessionButton}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowOptOutConfirm(true)}
              className="text-[#102F43]/70 hover:text-rose-600 underline cursor-pointer"
            >
              {t.optOutButton}
            </button>
          </div>
        </div>
      </div>

      {/* DPDP Opt-Out Modal */}
      {showOptOutConfirm && (
        <div className="absolute inset-0 bg-[#102F43]/70 backdrop-blur-xs flex items-center justify-center p-5 z-20">
          <div className="rounded-2xl border border-rose-200 bg-white p-6 max-w-sm text-[#102F43] shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <PhoneOff className="h-5 w-5" />
              <h4 className="font-semibold text-sm">{t.optOutModalTitle}</h4>
            </div>
            <p className="text-xs text-[#102F43]/80 leading-relaxed">{t.optOutModalBody}</p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowOptOutConfirm(false)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[#102F43]/70 hover:bg-[#F7F8F4] transition-colors cursor-pointer"
              >
                {t.optOutCancelButton}
              </button>
              <button
                type="button"
                disabled={isOptingOut}
                onClick={handleOptOut}
                className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isOptingOut ? t.optOutProcessingButton : t.optOutConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getWelcomeGreeting(lang: Language, name: string): string {
  if (lang === "HI") {
    return `नमस्ते ${name}! मैं ENQUIVO AI कंसीयर्ज हूँ। मैं आपको अहमदाबाद के हमारे लक्जरी प्रोजेक्ट्स (प्रकृति हाइट्स और वास्तु एन्क्लेव) की 2 और 3 BHK कॉन्फ़िगरेशन, कीमतों और साइट विज़िट उपलब्धता की सत्यापित जानकारी दे सकता हूँ। मैं आपकी क्या मदद कर सकता हूँ?`;
  }
  if (lang === "GU") {
    return `નમસ્તે ${name}! હું ENQUIVO AI કોન્સિયર્જ છું. હું તમને અમદાવાદના અમારા લક્ઝરી પ્રોજેક્ટ્સ (પ્રકૃતિ હાઇટ્સ અને વાસ્તુ એન્ક્લેવ) ની 2 અને 3 BHK વિગતો, કિંમતો અને સાઇટ મુલાકાત વિશે ચકાસાયેલ માહિતી આપી શકું છું. હું તમારી શું મદદ કરી શકું?`;
  }
  return `Hello ${name}! I am the ENQUIVO AI Concierge. I am grounded strictly in verified developer facts for Prakriti Heights (SG Highway) and Vaastu Enclave (Shela). Ask me about 2 & 3 BHK configurations, pricing (₹65L–₹1.2Cr), amenities, or site visit scheduling. How can I assist you today?`;
}
