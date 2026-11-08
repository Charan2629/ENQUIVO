/**
 * src/lib/chat-message.ts
 *
 * Centralized utilities for ChatMessage classification, filtering, and isolation.
 * Guarantees strict boundary defense between buyer-facing conversation turns
 * and internal staff audit trail logs (e.g. ownership assignment entries).
 */

import { ChatMessageRole } from "@prisma/client";

export const INTERNAL_AUDIT_PREFIXES = [
  "[Ownership Assigned]",
  "[Ownership Reassigned]",
  "[ASSIGNMENT AUDIT]",
  "[AUDIT]",
] as const;

export interface MessageLike {
  role?: ChatMessageRole | string;
  content?: string | null;
}

/**
 * Evaluates whether a chat message is an internal system audit record.
 * To prevent spoofing or accidental suppression of buyer messages,
 * an audit message must satisfy BOTH:
 * 1. Its role is 'AI' (ChatMessageRole.AI).
 * 2. Its content begins with a recognized internal audit prefix.
 *
 * Can be called as:
 * - isInternalAuditMessage(messageObject)
 * - isInternalAuditMessage(content, role)
 */
export function isInternalAuditMessage(
  messageOrContent: MessageLike | string | null | undefined,
  role?: ChatMessageRole | string
): boolean {
  if (!messageOrContent) return false;

  let content: string | null | undefined;
  let messageRole: string | undefined;

  if (typeof messageOrContent === "object") {
    content = messageOrContent.content;
    messageRole = messageOrContent.role;
  } else {
    content = messageOrContent;
    messageRole = role;
  }

  // An internal audit message MUST have role 'AI' (or ChatMessageRole.AI)
  if (messageRole !== "AI" && messageRole !== ChatMessageRole.AI) {
    return false;
  }

  if (!content) return false;
  const trimmed = content.trim();
  return INTERNAL_AUDIT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Strips internal system audit records from any chat message array.
 * Must be applied on all buyer-facing retrieval paths and AI context preparation
 * to guarantee that internal staff assignments, executive names, and system notes
 * never leak to buyers or prompt context windows.
 *
 * Messages with role 'USER' are ALWAYS preserved, even if their content starts
 * with an audit prefix (anti-spoofing).
 */
export function filterBuyerFacingMessages<
  T extends { role?: ChatMessageRole | string; content: string }
>(messages: T[]): T[] {
  return messages.filter((m) => !isInternalAuditMessage(m));
}
