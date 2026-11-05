import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processDueRemindersFunction } from "@/services/reminder/reminder.inngest";

/**
 * Next.js App Router route handlers for Inngest.
 * Exposes GET, POST, PUT endpoints for Inngest execution and webhook handshakes.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDueRemindersFunction],
});
