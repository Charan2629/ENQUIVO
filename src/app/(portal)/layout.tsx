import React from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth-guard";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalHeader } from "@/components/portal/portal-header";

export const instant = false;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();

  if (!session) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar Navigation */}
      <PortalNav
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <PortalHeader user={user} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
