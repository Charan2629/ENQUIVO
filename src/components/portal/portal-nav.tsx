"use client";

import React, { useEffect, useRef } from "react";
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
  X,
} from "lucide-react";
import { SanitizedStaffUser } from "@/services/auth/staff-auth.service";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
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

interface PortalNavProps {
  userRole: UserRole;
  userName: string;
  userEmail: string;
}

/**
 * Desktop sidebar navigation component.
 * Hidden on viewports smaller than md (<768px).
 * Styled with ENQUIVO Deep Ocean and Jade Teal palette.
 */
export function PortalNav({ userRole, userName, userEmail }: PortalNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 bg-[#102F43] border-r border-[#183442] flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#183442] gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#E7F4F4]/15 border border-[#13A99A]/40 flex items-center justify-center text-[#38C2B4]">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <span className="font-serif font-bold text-white tracking-wide text-base">
            ENQUIVO
          </span>
          <span className="ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#183442] text-[#D6B56D] border border-[#D6B56D]/30">
            Staff
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
          Operations Management
        </div>

        {NAV_ITEMS.map((item) => {
          if (!item.roles.includes(userRole)) {
            return null;
          }

          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-[#13A99A]/20 text-[#38C2B4] border border-[#13A99A]/35 shadow-xs font-semibold"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-[#38C2B4]" : "text-white/60"}`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge ? (
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-[#D6B56D]/20 text-[#D6B56D] border border-[#D6B56D]/40">
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-[#38C2B4]" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User Status Footer */}
      <div className="p-4 border-t border-[#183442] bg-[#0B2231]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-semibold text-white truncate">{userName}</div>
          <span
            className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
              userRole === UserRole.SALES_HEAD
                ? "bg-[#D6B56D]/20 text-[#D6B56D] border border-[#D6B56D]/30"
                : "bg-[#13A99A]/20 text-[#38C2B4] border border-[#13A99A]/30"
            }`}
          >
            {userRole === UserRole.SALES_HEAD ? "Sales Head" : "Executive"}
          </span>
        </div>
        <div className="text-[11px] text-white/60 truncate">{userEmail}</div>
      </div>
    </aside>
  );
}

interface PortalMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: SanitizedStaffUser;
}

/**
 * Accessible slide-over navigation drawer for mobile viewports (<768px).
 * Closes on route selection, backdrop click, or Escape key press.
 */
export function PortalMobileDrawer({
  isOpen,
  onClose,
  user,
}: PortalMobileDrawerProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const prevPathnameRef = useRef(pathname);

  // Close automatically when route transitions
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  // Handle Escape key to dismiss drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" aria-labelledby="mobile-nav-heading">
      {/* Semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-[#0B2231]/80 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over drawer container */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Staff Operations Navigation"
        className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#102F43] border-r border-[#183442] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
      >
        {/* Brand Header & Close Button */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#183442]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E7F4F4]/15 border border-[#13A99A]/40 flex items-center justify-center text-[#38C2B4]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span id="mobile-nav-heading" className="font-serif font-bold text-white tracking-wide text-base">
                ENQUIVO
              </span>
              <span className="ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#183442] text-[#D6B56D] border border-[#D6B56D]/30">
                Staff
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
            Operations Management
          </div>

          {NAV_ITEMS.map((item) => {
            if (!item.roles.includes(user.role)) {
              return null;
            }

            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#13A99A]/20 text-[#38C2B4] border border-[#13A99A]/35 shadow-xs font-semibold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-[#38C2B4]" : "text-white/60"}`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-[#D6B56D]/20 text-[#D6B56D] border border-[#D6B56D]/40">
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#38C2B4]" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* User Status Footer */}
        <div className="p-4 border-t border-[#183442] bg-[#0B2231]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-semibold text-white truncate">{user.name}</div>
            <span
              className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                user.role === UserRole.SALES_HEAD
                  ? "bg-[#D6B56D]/20 text-[#D6B56D] border border-[#D6B56D]/30"
                  : "bg-[#13A99A]/20 text-[#38C2B4] border border-[#13A99A]/30"
              }`}
            >
              {user.role === UserRole.SALES_HEAD ? "Sales Head" : "Executive"}
            </span>
          </div>
          <div className="text-[11px] text-white/60 truncate">{user.email}</div>
        </div>
      </div>
    </div>
  );
}
