import React from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStaffSession } from "@/lib/auth-guard";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalHeader } from "@/components/portal/portal-header";

export const instant = false;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Explicit request-time boundary for Next.js 16 (Cache Components)
  await connection();

  const session = await getStaffSession();

  if (!session) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="min-h-screen bg-[#0B2231] text-stone-100 flex font-sans">
      {/* Desktop Sidebar Navigation (Hidden on Mobile) */}
      <PortalNav
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PortalHeader user={user} />
        <main className="flex-1 p-3.5 sm:p-5 md:p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
