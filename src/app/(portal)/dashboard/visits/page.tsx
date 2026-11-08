import React from "react";
import { requireStaffSession } from "@/lib/auth-guard";
import { bookingService } from "@/services/booking/booking.service";
import { VisitsManagerClient } from "@/components/portal/visits/visits-manager-client";

export const instant = false;

export default async function VisitsPage() {
  const session = await requireStaffSession();
  const initialVisitMetrics = await bookingService.getVisitMetrics(session.user);

  return (
    <VisitsManagerClient
      userRole={session.user.role}
      initialVisitMetrics={initialVisitMetrics}
    />
  );
}
