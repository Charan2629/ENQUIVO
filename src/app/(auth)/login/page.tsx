import React, { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth-guard";
import { LoginForm } from "./login-form";

export const instant = false;

interface LoginPageProps {
  searchParams?: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Explicit request-time boundary for Next.js 16 (Cache Components)
  await connection();

  // If the user already has a valid database-backed session, redirect away from login
  const session = await getStaffSession();
  if (session) {
    const params = searchParams ? await searchParams : {};
    const rawFrom = params.from;
    const from =
      rawFrom && rawFrom.startsWith("/") && !rawFrom.startsWith("//")
        ? rawFrom
        : "/dashboard";
    redirect(from);
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B2231] flex items-center justify-center text-white/50 text-sm">
          Loading portal authentication...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
