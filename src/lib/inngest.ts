import { Inngest } from "inngest";

/**
 * Inngest client instance for ENQUIVO.
 * Used for background job dispatching, scheduled crons, and durable event workflows.
 */
export const inngest = new Inngest({
  id: "enquivo",
  name: "ENQUIVO Real Estate Concierge",
});
