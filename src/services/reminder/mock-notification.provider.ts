import { formatInTimeZone } from "date-fns-tz";
import { ReminderType } from "@prisma/client";

export interface MockNotificationPayload {
  recipientPhone: string;
  recipientName: string;
  reminderType: ReminderType;
  slotStartsAt: Date;
  location?: string;
  leadCode?: string;
  idempotencyKey?: string;
}

export interface MockNotificationResult {
  success: boolean;
  messageId: string;
  messageText: string;
  simulationNote: string;
}

export type MockNotificationProvider = (
  payload: MockNotificationPayload
) => Promise<MockNotificationResult>;

/**
 * Default mock notification provider for ENQUIVO.
 *
 * Formats appointment time in Asia/Kolkata (IST), logs simulated WhatsApp/SMS dispatch,
 * and produces deterministic audit simulation notes without making external network calls.
 */
export const defaultMockNotificationProvider: MockNotificationProvider = async (
  payload: MockNotificationPayload
): Promise<MockNotificationResult> => {
  if (!payload.recipientPhone || payload.recipientPhone.trim() === "") {
    throw new Error("Cannot dispatch notification: recipient phone number is missing");
  }

  // Format in IST (Asia/Kolkata, UTC+5:30)
  const istFormattedTime = formatInTimeZone(
    payload.slotStartsAt,
    "Asia/Kolkata",
    "EEEE, dd MMMM yyyy 'at' hh:mm a 'IST'"
  );

  const venue = payload.location || "Enquivo Sales Gallery, Ahmedabad";
  const typeLabel =
    payload.reminderType === ReminderType.REMINDER_24H
      ? "24-Hour Reminder"
      : "2-Hour Reminder";

  const messageText = `[${typeLabel}] Hello ${payload.recipientName}, this is a reminder for your upcoming site visit scheduled for ${istFormattedTime} at ${venue}. Reply CANCEL if you cannot make it.`;

  const messageId = `sim-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const simulationNote = `[SIMULATED_${payload.reminderType}] To ${payload.recipientPhone}: "${messageText}" (MsgID: ${messageId})`;

  return {
    success: true,
    messageId,
    messageText,
    simulationNote,
  };
};
