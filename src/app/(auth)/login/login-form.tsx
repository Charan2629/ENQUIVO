"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Building2,
  ShieldCheck,
} from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const from =
    rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
      ? rawFrom
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    setRetryAfter(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setRetryAfter(data.retryAfterSeconds || 60);
          setError(
            `Rate limit exceeded: Too many attempts. Try again in ${
              data.retryAfterSeconds || 60
            } seconds.`
          );
        } else {
          setError(data.error || "Authentication failed. Please check your credentials.");
        }
        setLoading(false);
        return;
      }

      // Success -> Clean transition to portal dashboard.
      // window.location.replace replaces /login in the browser history,
      // preventing back-button redirect loops and guaranteeing the browser
      // attaches the newly set HttpOnly cookie on the fresh request.
      window.location.replace(from);
    } catch {
      setError("Network or server error occurred. Please try again.");
      setLoading(false);
    }
  };

  const fillCredentials = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setError(null);
  };

  const showDemoLogins =
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGINS === "true" ||
    process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen bg-[#0B2231] text-stone-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#13A99A]/20 border border-[#13A99A]/30 text-[#38C2B4] mb-4 shadow-lg shadow-[#102F43]/40">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-white">ENQUIVO</h1>
        <p className="mt-1 text-sm text-white/60">Staff Operations & Sales Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-[#38C2B4] transition-colors group cursor-pointer"
            aria-label="Return to Residences"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#38C2B4] group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to Residences</span>
          </Link>
          <span className="text-[11px] text-white/40">Public Showcase</span>
        </div>

        <div className="bg-[#102F43]/90 border border-[#183442] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#183442]">
            <div>
              <h2 className="text-lg font-semibold text-white">Staff Sign In</h2>
              <p className="text-xs text-white/60 mt-0.5">Enter your verified staff credentials</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#13A99A]/15 text-[#38C2B4] border border-[#13A99A]/30 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" />
              Argon2id RBAC
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm animate-in fade-in duration-200">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {retryAfter && (
                  <p className="text-xs text-rose-400/80 mt-1">
                    Brute-force protection active. Cooldown in progress.
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-white/80 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales-head@enquivo.in"
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B2231] border border-[#183442] rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#13A99A]/50 focus:border-[#13A99A] transition-colors disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-white/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#0B2231] border border-[#183442] rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#13A99A]/50 focus:border-[#13A99A] transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white/80 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!retryAfter}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#13A99A] hover:bg-[#0E8074] disabled:bg-[#183442] disabled:text-white/40 text-white font-medium text-sm transition-all shadow-lg shadow-[#13A99A]/20 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Operations</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Credential Helpers for Evaluators (Shown in explicit Demo / Development Environment) */}
          {showDemoLogins && (
            <div className="mt-8 pt-6 border-t border-[#183442]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  Synthetic Evaluator Accounts
                </span>
                <span className="text-[10px] text-[#D6B56D] font-medium">Demo Environment Only</span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fillCredentials("sales-head@enquivo.in", "DemoEval#Head2026!")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#0B2231] hover:bg-[#183442]/70 border border-[#183442] hover:border-[#13A99A]/40 text-left transition-colors text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div>
                    <div className="font-medium text-white">Aarav Sharma (Sales Head)</div>
                    <div className="text-[11px] text-white/50">sales-head@enquivo.in</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#D6B56D]/15 text-[#D6B56D] border border-[#D6B56D]/30">
                    Full Access
                  </span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fillCredentials("vikram.mehta@enquivo.in", "DemoEval#ExecVikram2026!")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#0B2231] hover:bg-[#183442]/70 border border-[#183442] hover:border-[#13A99A]/40 text-left transition-colors text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div>
                    <div className="font-medium text-white">Vikram Mehta (Sales Exec)</div>
                    <div className="text-[11px] text-white/50">vikram.mehta@enquivo.in</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#13A99A]/15 text-[#38C2B4] border border-[#13A99A]/30">
                    Executive
                  </span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fillCredentials("priya.desai@enquivo.in", "DemoEval#ExecPriya2026!")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#0B2231] hover:bg-[#183442]/70 border border-[#183442] hover:border-[#13A99A]/40 text-left transition-colors text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div>
                    <div className="font-medium text-white">Priya Desai (Sales Exec)</div>
                    <div className="text-[11px] text-white/50">priya.desai@enquivo.in</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#13A99A]/15 text-[#38C2B4] border border-[#13A99A]/30">
                    Executive
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-white/40">
          <span>ENQUIVO AI Lead-Response & Site-Visit Assistant • Ahmedabad</span>
          <span className="hidden sm:inline text-white/20">•</span>
          <Link
            href="/"
            className="text-white/60 hover:text-[#38C2B4] transition-colors underline underline-offset-4"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
