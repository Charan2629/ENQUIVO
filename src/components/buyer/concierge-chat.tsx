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

interface ConciergeChatProps {
  initialProjectId?: string | null;
  className?: string;
  compact?: boolean;
}

const DPDP_CONSENT_TEXT =
  "I consent to ENQUIVO processing my name and contact number to provide verified residential property information and schedule site visits in Ahmedabad in accordance with the Digital Personal Data Protection (DPDP) Act 2023. I understand I can withdraw consent at any time.";

export function ConciergeChat({ initialProjectId, className = "", compact = false }: ConciergeChatProps) {
  // Session State
  const [loadingSession, setLoadingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [language, setLanguage] = useState<"EN" | "HI" | "GU">("EN");

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
            setLanguage(data.conversation?.language || "EN");
            setMessages(data.messages || []);
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
      setFormError("Please enter your full name.");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("Please enter your mobile phone number.");
      return;
    }
    if (!formConsent) {
      setFormError("Digital consent under the DPDP Act 2023 is required to proceed.");
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
          consentText: DPDP_CONSENT_TEXT,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to start concierge session.");
        return;
      }

      setAuthenticated(true);
      setBuyerName(data.lead?.name || formName);
      setLanguage(data.conversation?.language || language);

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
      setFormError(err instanceof Error ? err.message : "Network error starting session.");
    } finally {
      setIsSubmittingForm(false);
    }
  }

  // 3. Handle Sending a Chat Message (with clientMessageId for request-level idempotency)
  async function handleSendMessage(overrideMessage?: string, isRetry = false, retryClientMessageId?: string) {
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
        body: JSON.stringify({ message: textToSend, clientMessageId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLastFailedMessage({ text: textToSend, clientMessageId });
        if (res.status === 401 || res.status === 403) {
          setChatError(data.error || "Session ended or expired. Please re-authenticate.");
          setAuthenticated(false);
          return;
        }
        setChatError(
          data.error ||
            "The AI Concierge is currently experiencing temporary high demand. Please try again in a moment."
        );
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
        err instanceof Error && err.message
          ? "Network connection interrupted. Please try again or connect with our sales team."
          : "Network error. Please try again."
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
          setChatError(data.error || "Session ended or expired. Please re-authenticate.");
          setAuthenticated(false);
          return;
        }
        setChatError(
          data.error || "Failed to connect with sales team. Please try again."
        );
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
        err instanceof Error && err.message
          ? "Network connection interrupted while connecting to sales. Please try again."
          : "Network error. Please try again."
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
      alert("Your consent has been successfully withdrawn. You will receive no further communications.");
    } catch (err) {
      console.error("Failed to opt out:", err);
      alert("Failed to record opt-out. Please refresh and try again.");
    } finally {
      setIsOptingOut(false);
    }
  }

  // Loading Session Skeleton
  if (loadingSession) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-2xl bg-stone-900 border border-white/10 text-stone-300 min-h-[400px] ${className}`}>
        <RefreshCw className="h-6 w-6 animate-spin text-amber-400 mb-3" />
        <p className="text-xs uppercase tracking-wider text-stone-400">Initializing Secure Session...</p>
      </div>
    );
  }

  // State 1: Intake & Digital Consent Form
  if (!authenticated) {
    return (
      <div className={`rounded-2xl border border-white/15 bg-stone-900 p-6 sm:p-8 text-stone-100 shadow-xl backdrop-blur-md ${className}`}>
        <div className="flex items-center justify-between pb-4 border-b border-white/10 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="font-serif text-base sm:text-lg font-medium text-white tracking-wide truncate">
              ENQUIVO AI Concierge
            </h3>
          </div>
          <div className="flex items-center rounded-lg bg-white/5 p-0.5 border border-white/10 shrink-0 text-xs">
            {(["EN", "HI", "GU"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2 sm:px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  language === lang
                    ? "bg-amber-400 text-stone-950 shadow-xs font-bold"
                    : "text-stone-300 hover:text-white hover:bg-white/10"
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

        <p className="mt-4 text-xs text-stone-300 leading-relaxed">
          {language === "HI"
            ? "प्रकृति हाइट्स और वास्तु एन्क्लेव के बारे में 24/7 तत्काल सत्यापित जानकारी प्राप्त करें और निजी साइट विज़िट बुक करें।"
            : language === "GU"
            ? "પ્રકૃતિ હાઇટ્સ અને વાસ્તુ એન્ક્લેવ વિશે 24/7 ત્વરિત ચકાસાયેલ માહિતી મેળવો અને ખાનગી સાઇટ મુલાકાત બુક કરો."
            : "Connect instantly with our grounded residential AI assistant for Prakriti Heights and Vaastu Enclave. All replies are strictly grounded in verified developer facts."}
        </p>

        {formError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-500/10 p-3 border border-rose-500/20 text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleStartSession} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Full Name <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Hardik Patel"
              className="w-full rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-stone-500 border border-white/10 focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Mobile Phone Number (India) <span className="text-amber-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-stone-500 border border-white/10 focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Email Address <span className="text-stone-500 font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-stone-500 border border-white/10 focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Project Interest
            </label>
            <select
              value={formProject}
              onChange={(e) => setFormProject(e.target.value)}
              className="w-full rounded-xl bg-stone-800 px-3 py-2 text-xs text-white border border-white/10 focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
            >
              <option value="">All Projects (Ahmedabad Portfolio)</option>
              <option value="proj_prakriti_heights">Prakriti Heights (SG Highway Corridor)</option>
              <option value="proj_vaastu_enclave">Vaastu Enclave (Shela / South Bopal)</option>
            </select>
          </div>

          {/* DPDP Act 2023 Digital Consent Affirmation */}
          <div className="rounded-xl bg-white/5 p-3.5 border border-white/10">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formConsent}
                onChange={(e) => setFormConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-600 bg-stone-800 text-amber-500 focus:ring-amber-400"
              />
              <span className="text-[11px] leading-relaxed text-stone-300">
                <strong className="text-white">DPDP Act 2023 Consent:</strong> I agree to ENQUIVO processing my details to respond to property enquiries and schedule site visits. I may withdraw consent at any time.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmittingForm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-semibold text-stone-950 shadow-sm hover:bg-amber-300 focus:outline-hidden transition-colors disabled:opacity-50"
          >
            {isSubmittingForm ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Establishing Secure Session...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Start AI Concierge Consultation</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-stone-400">
          <Lock className="h-3 w-3 text-emerald-400" />
          <span>HTTP-only signed cookie session. No marketing spam.</span>
        </div>
      </div>
    );
  }

  // State 2: Active Authenticated Chat Experience
  return (
    <div className={`flex flex-col rounded-2xl border border-white/15 bg-stone-900 text-stone-100 shadow-2xl backdrop-blur-md overflow-hidden ${compact ? "h-[500px]" : "h-[580px] sm:h-[650px] lg:h-[680px]"} ${className}`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-white/5 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Bot className="h-4 w-4" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-stone-900 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="font-serif text-xs sm:text-sm font-semibold text-white truncate">
                ENQUIVO Concierge
              </h3>
              <span className="shrink-0 text-[9px] sm:text-[10px] font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Grounded
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">
              {buyerName ? `Consulting with ${buyerName}` : "Verified Residential Assistant"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Language Toggle */}
          <div className="flex items-center rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs">
            {(["EN", "HI", "GU"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  language === lang
                    ? "bg-amber-400 text-stone-950 font-bold"
                    : "text-stone-400 hover:text-white"
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
            title="Connect with senior sales executive"
            aria-label="Connect with senior sales executive"
            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 sm:px-2.5 py-1 text-[11px] font-medium text-stone-200 hover:bg-white/20 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
          >
            <UserCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline">Sales Exec</span>
          </button>

          {/* End / Opt-Out Menu */}
          <button
            type="button"
            onClick={() => setShowOptOutConfirm(true)}
            title="End session or manage privacy"
            aria-label="End session"
            className="p-1 sm:p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Human Handoff Banner (if escalated) */}
      {handoff && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-white">Connected with {handoff.assignedToName}:</span>{" "}
            <span>{handoff.summary} (Status: {handoff.status})</span>
          </div>
        </div>
      )}

      {/* Message History Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-4.5 text-xs sm:text-[13px]">
        {filterBuyerFacingMessages(messages).map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 sm:gap-3 ${m.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "AI" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-4.5 sm:py-3.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                m.role === "USER"
                  ? "bg-amber-400 text-stone-950 font-medium rounded-tr-xs"
                  : "bg-stone-800/90 text-stone-100 rounded-tl-xs border border-white/10"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Verified Grounding Badge */}
              {m.role === "AI" && m.groundingFactIds && m.groundingFactIds.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Grounded in {m.groundingFactIds.length} verified developer facts</span>
                </div>
              )}
            </div>

            {m.role === "USER" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-stone-300 border border-white/10 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Loading / Typing Indicator */}
        {isSending && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white/10 px-4 py-3 border border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-2 text-[10px] text-stone-400">Consulting verified database...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert with Working Retry and Human Escalation Fallback */}
        {chatError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-rose-500/10 p-3.5 border border-rose-500/25 text-rose-300 text-xs shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{chatError}</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {lastFailedMessage && (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isSending ? "animate-spin" : ""}`} />
                  <span>Retry</span>
                </button>
              )}
              <button
                type="button"
                disabled={isSending}
                onClick={handleRequestHuman}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 text-[11px] font-medium text-stone-200 hover:bg-white/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <UserCheck className="h-3 w-3 text-amber-400" />
                <span>Talk to Sales</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Inquiries */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-[10px] text-stone-500 uppercase tracking-wider shrink-0">Quick:</span>
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage("What are the prices and configurations for 2 and 3 BHK?")}
            className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-stone-300 hover:bg-white/10 border border-white/10 disabled:opacity-40"
          >
            Prices & 2/3 BHK
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage("Tell me about Prakriti Heights on SG Highway")}
            className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-stone-300 hover:bg-white/10 border border-white/10 disabled:opacity-40"
          >
            Prakriti Heights
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() => handleSendMessage("What site visit slots are available this week?")}
            className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-stone-300 hover:bg-white/10 border border-white/10 disabled:opacity-40"
          >
            Visit Availability
          </button>
        </div>
      )}

      {/* Message Composer */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-white/5">
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
            placeholder={
              language === "HI"
                ? "अपना प्रश्न यहाँ टाइप करें..."
                : language === "GU"
                ? "તમારો પ્રશ્ન અહીં લખો..."
                : "Ask about configurations, pricing, or visit availability..."
            }
            className="flex-1 rounded-xl bg-white/5 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-stone-500 border border-white/10 focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            aria-label="Send message"
            className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-stone-950 hover:bg-amber-300 disabled:opacity-40 transition-colors focus:outline-hidden cursor-pointer shadow-xs"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Regulatory & Privacy Notice */}
        <div className="mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-[10px] text-stone-400 text-center sm:text-left">
          <span>RERA Reg: DEMO-ONLY-NOT-VERIFIED</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEndSession}
              className="text-stone-400 hover:text-stone-200 underline cursor-pointer"
            >
              End Chat
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setShowOptOutConfirm(true)}
              className="text-stone-400 hover:text-rose-400 underline cursor-pointer"
            >
              Opt Out (DPDP)
            </button>
          </div>
        </div>
      </div>

      {/* DPDP Opt-Out Modal */}
      {showOptOutConfirm && (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-5 z-20">
          <div className="rounded-2xl border border-rose-500/30 bg-stone-900 p-6 max-w-sm text-stone-100 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <PhoneOff className="h-5 w-5" />
              <h4 className="font-semibold text-sm">Withdraw Consent & Opt Out?</h4>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Under the Digital Personal Data Protection (DPDP) Act 2023, exercising your right to opt out will immediately revoke your active session and suppress any future automated communication.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowOptOutConfirm(false)}
                className="rounded-xl px-3.5 py-1.5 text-xs text-stone-300 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isOptingOut}
                onClick={handleOptOut}
                className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
              >
                {isOptingOut ? "Processing..." : "Confirm Opt-Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getWelcomeGreeting(lang: "EN" | "HI" | "GU", name: string): string {
  if (lang === "HI") {
    return `नमस्ते ${name}! मैं ENQUIVO AI Concierge हूँ। मैं आपको अहमदाबाद के हमारे लक्जरी प्रोजेक्ट्स (प्रकृति हाइट्स और वास्तु एन्क्लेव) की 2 और 3 BHK कॉन्फ़िगरेशन, कीमतों और साइट विज़िट उपलब्धता की सत्यापित जानकारी दे सकता हूँ। मैं आपकी क्या मदद कर सकता हूँ?`;
  }
  if (lang === "GU") {
    return `નમસ્તે ${name}! હું ENQUIVO AI Concierge છું. હું તમને અમદાવાદના અમારા લક્ઝરી પ્રોજેક્ટ્સ (પ્રકૃતિ હાઇટ્સ અને વાસ્તુ એન્ક્લેવ) ની 2 અને 3 BHK વિગતો, કિંમતો અને સાઇટ મુલાકાત વિશે ચકાસાયેલ માહિતી આપી શકું છું. હું તમારી શું મદદ કરી શકું?`;
  }
  return `Hello ${name}! I am the ENQUIVO AI Concierge. I am grounded strictly in verified developer facts for Prakriti Heights (SG Highway) and Vaastu Enclave (Shela). Ask me about 2 & 3 BHK configurations, pricing (₹65L–₹1.2Cr), amenities, or site visit scheduling. How can I assist you today?`;
}
