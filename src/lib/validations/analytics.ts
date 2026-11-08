import { z } from "zod";
import { LeadSource } from "@prisma/client";

/**
 * Validation schema for Source Attribution & ROI Analytics queries.
 */
export const sourceAnalyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  monthYear: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-MM").optional().or(z.literal("ALL")),
  projectId: z.string().optional().or(z.literal("ALL")),
});

export type ValidatedSourceAnalyticsQuery = z.infer<typeof sourceAnalyticsQuerySchema>;

/**
 * Lead source display labels and visual metadata.
 */
export const LEAD_SOURCE_META: Record<
  LeadSource,
  { label: string; description: string; color: string }
> = {
  [LeadSource.PROPERTY_PORTAL]: {
    label: "Property Portal",
    description: "Portals like 99acres, MagicBricks, Housing.com",
    color: "#06b6d4", // cyan-500
  },
  [LeadSource.SOCIAL_MEDIA_AD]: {
    label: "Social Media Ads",
    description: "Paid Meta (Instagram/Facebook) and Google Ads",
    color: "#8b5cf6", // purple-500
  },
  [LeadSource.WEBSITE]: {
    label: "Website Direct",
    description: "Direct brand portal search, organic and referral traffic",
    color: "#10b981", // emerald-500
  },
  [LeadSource.HOARDING_CALL]: {
    label: "Hoarding Call",
    description: "Physical outdoor billboards and corridor signage in Ahmedabad",
    color: "#f59e0b", // amber-500
  },
  [LeadSource.REFERRAL]: {
    label: "Referral",
    description: "Word of mouth and existing customer referrals",
    color: "#ec4899", // pink-500
  },
  [LeadSource.OTHER]: {
    label: "Other Channels",
    description: "Walk-ins and miscellaneous channels",
    color: "#64748b", // slate-500
  },
};
