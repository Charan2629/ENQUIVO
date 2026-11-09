import React from "react";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#183442]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#183442] shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-[#183442] rounded-md" />
            <div className="h-3.5 w-72 bg-[#183442]/60 rounded-md" />
          </div>
        </div>
        <div className="h-8 w-56 bg-[#183442]/40 rounded-xl" />
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-[#102F43] border border-[#183442] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-[#183442] rounded" />
              <div className="w-4 h-4 bg-[#183442] rounded" />
            </div>
            <div className="h-7 w-16 bg-[#183442] rounded-md" />
            <div className="h-2.5 w-24 bg-[#183442]/50 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton (Table / Card Container) */}
      <div className="rounded-2xl bg-[#102F43] border border-[#183442] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#183442]">
          <div className="h-9 w-64 bg-[#0B2231] rounded-lg" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-[#0B2231] rounded-lg" />
            <div className="h-9 w-28 bg-[#0B2231] rounded-lg" />
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-12 bg-[#0B2231]/60 rounded-lg border border-[#183442]/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

