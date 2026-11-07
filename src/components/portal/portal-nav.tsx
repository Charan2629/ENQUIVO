"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Users,
  Headphones,
  CalendarCheck,
  FileCheck2,
  BarChart3,
  Building2,
  ChevronRight,
} from "lucide-react";

interface PortalNavProps {
  userRole: UserRole;
  userName: string;
  userEmail: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.SALES_HEAD, UserRole.SALES_EXEC],
  },
  {
    name: "Lead Pipeline",
    href: "/dashboard/leads",
    icon: Users,
    roles: [UserRole.SALES_HEAD, UserRole.SALES_EXEC],
  },
  {
    name: "Handoff Queue",
    href: "/dashboard/handoffs",
    icon: Headphones,
    roles: [UserRole.SALES_HEAD, UserRole.SALES_EXEC],
  },
  {
    name: "Site Visits & Slots",
    href: "/dashboard/visits",
    icon: CalendarCheck,
    roles: [UserRole.SALES_HEAD, UserRole.SALES_EXEC],
  },
  {
    name: "Fact Sheet Editor",
    href: "/dashboard/fact-sheet",
    icon: FileCheck2,
    roles: [UserRole.SALES_HEAD], // Strict SALES_HEAD only!
    badge: "Head Only",
  },
  {
    name: "Source Performance",
    href: "/dashboard/sources",
    icon: BarChart3,
    roles: [UserRole.SALES_HEAD, UserRole.SALES_EXEC],
  },
];

export function PortalNav({ userRole, userName, userEmail }: PortalNavProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-white tracking-tight text-base">ENQUIVO</span>
          <span className="ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            Staff
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Operations Management
        </div>

        {NAV_ITEMS.map((item) => {
          // Check role access
          if (!item.roles.includes(userRole)) {
            return null;
          }

          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </div>
              {item.badge ? (
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* User Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-semibold text-white truncate">{userName}</div>
          <span
            className={`text-[9px] uppercase font-semibold px-2 py-0.5 rounded ${
              userRole === UserRole.SALES_HEAD
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
            }`}
          >
            {userRole === UserRole.SALES_HEAD ? "Sales Head" : "Executive"}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 truncate">{userEmail}</div>
      </div>
    </aside>
  );
}
