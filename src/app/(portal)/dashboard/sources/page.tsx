import React from "react";
import { connection } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { sourceAnalyticsService } from "@/services/analytics/source-analytics.service";
import { SourceAnalyticsClient } from "@/components/portal/sources/source-analytics-client";

export const instant = false;

export default async function SourcesPage() {
  await connection();
  const session = await requireStaffSession();

  const initialData = await sourceAnalyticsService.getSourceAnalytics(
    { monthYear: "2026-11" },
    session.user
  );

  return (
    <SourceAnalyticsClient
      userRole={session.user.role}
      userName={session.user.name}
      initialData={initialData}
    />
  );
}
