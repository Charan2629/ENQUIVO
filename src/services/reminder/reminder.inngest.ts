import { inngest } from "@/lib/inngest";
import { ReminderService } from "./reminder.service";

/**
 * Inngest scheduled function to process due pre-visit reminder jobs.
 *
 * Runs automatically every 5 minutes via cron, and can also be triggered
 * on-demand by sending the `enquivo/reminders.process` event.
 */
export const processDueRemindersFunction = inngest.createFunction(
  {
    id: "process-due-reminders",
    name: "Process Due Pre-Visit Reminders",
    triggers: [
      { cron: "*/5 * * * *" },
      { event: "enquivo/reminders.process" },
    ],
  },
  async ({ step }) => {
    const reminderService = new ReminderService();

    const result = await step.run("process-due-reminders-batch", async () => {
      return await reminderService.processDueReminders(50);
    });

    return {
      success: true,
      result,
    };
  }
);
