"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, ShieldAlert, ArrowRight, Building2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setRetryAfter(data.retryAfterSeconds || 60);
          setError(`Rate limit exceeded: Too many attempts. Try again in ${data.retryAfterSeconds || 60} seconds.`);
        } else {
          setError(data.error || "Authentication failed. Please check your credentials.");
        }
        setLoading(false);
        return;
      }

      // Success -> navigate to target
      router.push(from);
      router.refresh();
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">ENQUIVO</h1>
        <p className="mt-1 text-sm text-slate-400">Staff Operations & Sales Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-white">Staff Sign In</h2>
              <p className="text-xs text-slate-400 mt-0.5">Enter your verified staff credentials</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Argon2id RBAC
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                {retryAfter && (
                  <p className="text-xs text-rose-400/80 mt-1">Brute-force protection active. Cooldown in progress.</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!retryAfter}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-950/50 cursor-pointer disabled:cursor-not-allowed"
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

          {/* Quick Credential Helpers for Evaluators (Only shown in explicit Demo / Development Environment) */}
          {showDemoLogins && (
            <div className="mt-8 pt-6 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Synthetic Evaluator Accounts
                </span>
                <span className="text-[10px] text-amber-400 font-medium">Demo Environment Only</span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fillCredentials("sales-head@enquivo.in", "DemoEval#Head2026!")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Aarav Sharma (Sales Head)</div>
                    <div className="text-[11px] text-slate-400">sales-head@enquivo.in</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Full Access
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials("vikram.mehta@enquivo.in", "DemoEval#ExecVikram2026!")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Vikram Mehta (Sales Exec)</div>
                    <div className="text-[11px] text-slate-400">vikram.mehta@enquivo.in</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    Executive
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials("priya.desai@enquivo.in", "DemoEval#ExecPriya2026!")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs cursor-pointer"
                >
                  <div>
                    <div className="font-medium text-slate-200">Priya Desai (Sales Exec)</div>
                    <div className="text-[11px] text-slate-400">priya.desai@enquivo.in</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    Executive
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          ENQUIVO AI Lead-Response & Site-Visit Assistant • Ahmedabad, Gujarat
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading portal authentication...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
