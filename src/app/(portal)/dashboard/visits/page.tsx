import React from "react";
import { connection } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { bookingService } from "@/services/booking/booking.service";
import { VisitsManagerClient } from "@/components/portal/visits/visits-manager-client";

export const instant = false;

export default async function VisitsPage() {
  await connection();
  const session = await requireStaffSession();
  const [initialVisitMetrics, initialVisitsData] = await Promise.all([
    bookingService.getVisitMetrics(session.user),
    bookingService.getVisits(
      {
        page: 1,
        limit: 20,
        timeframe: "ALL",
        bookingStatus: "ALL",
        attendanceOutcome: "ALL",
      },
      session.user
    ),
  ]);

  return (
    <VisitsManagerClient
      userRole={session.user.role}
      initialVisitMetrics={initialVisitMetrics}
      initialVisits={initialVisitsData.visits}
      initialPagination={initialVisitsData.pagination}
    />
  );
}
