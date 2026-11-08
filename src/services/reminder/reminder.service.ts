import {
  PrismaClient,
  ReminderStatus,
  BookingStatus,
  AttendanceOutcome,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  MockNotificationProvider,
  defaultMockNotificationProvider,
} from "./mock-notification.provider";

export type ProcessJobStatus =
  | "SENT"
  | "RETRIED"
  | "FAILED"
  | "SKIPPED_NO_CONSENT"
  | "SKIPPED_OPTED_OUT"
  | "SKIPPED_MISSING_PHONE"
  | "SKIPPED_ALREADY_CLAIMED"
  | "SKIPPED_NOT_FOUND"
  | "SKIPPED_VISIT_NOT_CONFIRMED";

export interface ProcessJobResult {
  jobId: string;
  status: ProcessJobStatus;
  attempts?: number;
  maxAttempts?: number;
  reason?: string;
  simulationNote?: string;
}

export interface ProcessRemindersResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  retriedCount: number;
  details: ProcessJobResult[];
}

/**
 * Service managing background pre-visit reminder jobs for ENQUIVO.
 *
 * Responsibilities:
 * 1. Process due PENDING reminders (`scheduledFor <= now`).
 * 2. Concurrency-safe job claiming via atomic conditional update (`updateMany`).
 * 3. Stale PROCESSING job recovery for worker crash tolerance (10-minute threshold).
 * 4. Booking integrity: verifies parent SiteVisit is CONFIRMED before dispatch.
 * 5. DPDP Act 2023 compliance: suppresses dispatch and purges unsendable jobs if opted out or missing consent.
 * 6. Bounded retry policy: up to 3 attempts with 5-minute backoff before marking FAILED.
 * 7. Non-network mock notification provider formatting time in Asia/Kolkata (IST).
 */
export class ReminderService {
  constructor(
    private db: PrismaClient = defaultPrisma,
    private notificationProvider: MockNotificationProvider = defaultMockNotificationProvider
  ) {}

  /**
   * Processes all due PENDING reminder jobs up to the specified batch size,
   * preceded by a stale-lock reclamation sweep for crashed workers.
   */
  async processDueReminders(batchSize = 20): Promise<ProcessRemindersResult> {
    const now = new Date();

    // 1. Stale PROCESSING job recovery:
    // Identify jobs in PROCESSING whose lastAttemptAt is at least 10 minutes old.
    const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);

    // Return jobs with attempts below 3 to PENDING for eventual retry
    await this.db.reminderJob.updateMany({
      where: {
        status: ReminderStatus.PROCESSING,
        lastAttemptAt: { lte: staleThreshold },
        attempts: { lt: 3 },
      },
      data: {
        status: ReminderStatus.PENDING,
      },
    });

    // Mark jobs with attempts >= 3 as FAILED with a clear worker-timeout reason
    await this.db.reminderJob.updateMany({
      where: {
        status: ReminderStatus.PROCESSING,
        lastAttemptAt: { lte: staleThreshold },
        attempts: { gte: 3 },
      },
      data: {
        status: ReminderStatus.FAILED,
        failureReason: "Worker timeout: Job remained stuck in PROCESSING beyond timeout threshold and exhausted maximum attempts",
        simulationNote: "[EXHAUSTED_TIMEOUT] Processing worker crashed or timed out after max attempts",
      },
    });

    // 2. Query due PENDING reminders
    const dueJobs = await this.db.reminderJob.findMany({
      where: {
        status: ReminderStatus.PENDING,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
      take: batchSize,
      select: { id: true },
    });

    const details: ProcessJobResult[] = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let retriedCount = 0;

    for (const job of dueJobs) {
      const result = await this.processReminderJob(job.id);
      details.push(result);

      if (result.status === "SENT") {
        sentCount++;
      } else if (result.status === "FAILED") {
        failedCount++;
      } else if (result.status === "RETRIED") {
        retriedCount++;
      } else {
        skippedCount++;
      }
    }

    return {
      processedCount: dueJobs.length,
      sentCount,
      failedCount,
      skippedCount,
      retriedCount,
      details,
    };
  }

  /**
   * Processes an individual reminder job with atomic claiming, consent validation,
   * booking status re-verification, and bounded retry error handling.
   */
  async processReminderJob(jobId: string): Promise<ProcessJobResult> {
    const now = new Date();

    // 1. Atomic conditional claim: update status from PENDING -> PROCESSING
    // Only one concurrent worker will succeed (count === 1).
    const claimResult = await this.db.reminderJob.updateMany({
      where: {
        id: jobId,
        status: ReminderStatus.PENDING,
      },
      data: {
        status: ReminderStatus.PROCESSING,
        lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    });

    if (claimResult.count === 0) {
      // Already claimed, completed, or cancelled by another worker
      return {
        jobId,
        status: "SKIPPED_ALREADY_CLAIMED",
      };
    }

    // 2. Fetch full job context with relations
    const job = await this.db.reminderJob.findUnique({
      where: { id: jobId },
      include: {
        siteVisit: {
          include: {
            lead: {
              include: {
                consentRecord: true,
              },
            },
            slot: true,
          },
        },
      },
    });

    if (!job) {
      return {
        jobId,
        status: "SKIPPED_NOT_FOUND",
      };
    }

    // 3. Recheck booking & attendance status: Never send reminders if visit is completed (ATTENDED/NO_SHOW), cancelled, or not CONFIRMED
    if (
      job.siteVisit.bookingStatus !== BookingStatus.CONFIRMED ||
      job.siteVisit.attendanceOutcome !== AttendanceOutcome.UNRECORDED
    ) {
      // Clean up orphaned reminder job without marking FAILED
      await this.db.reminderJob.delete({
        where: { id: job.id },
      });

      return {
        jobId,
        status: "SKIPPED_VISIT_NOT_CONFIRMED",
        reason: `SiteVisit is ${job.siteVisit.bookingStatus} (attendance: ${job.siteVisit.attendanceOutcome}), not active CONFIRMED`,
      };
    }

    // 4. DPDP Act 2023 Digital Consent & Opt-Out Enforcement
    const lead = job.siteVisit.lead;

    if (!lead.consentRecord) {
      // Missing consent: delete unsendable ReminderJob from operational queue
      await this.db.reminderJob.delete({
        where: { id: job.id },
      });

      return {
        jobId,
        status: "SKIPPED_NO_CONSENT",
        reason: "DPDP compliance: Lead lacks active digital consent record",
      };
    }

    if (lead.consentRecord.optedOut) {
      // Explicit opt-out: delete unsendable ReminderJob from operational queue
      await this.db.reminderJob.delete({
        where: { id: job.id },
      });

      return {
        jobId,
        status: "SKIPPED_OPTED_OUT",
        reason: "DPDP compliance: Lead has opted out of communications",
      };
    }

    // 5. Verify recipient phone presence
    if (!lead.phone || lead.phone.trim() === "") {
      await this.db.reminderJob.delete({
        where: { id: job.id },
      });

      return {
        jobId,
        status: "SKIPPED_MISSING_PHONE",
        reason: "Lead phone number is missing",
      };
    }

    // 6. Pre-dispatch atomic check: suppresses delivery if attendance was recorded or booking was
    // cancelled prior to this query. Note: A tiny TOCTOU window remains between this query returning
    // and the notificationProvider network call starting. Holding a database transaction open across
    // external network I/O is deliberately avoided to prevent connection pool exhaustion and lock contention.
    // Provider idempotencyKey protects against duplicate deliveries, but cannot cancel an authorized in-flight dispatch.
    const activeJob = await this.db.reminderJob.findFirst({
      where: {
        id: job.id,
        status: ReminderStatus.PROCESSING,
        siteVisit: {
          bookingStatus: BookingStatus.CONFIRMED,
          attendanceOutcome: AttendanceOutcome.UNRECORDED,
        },
      },
    });

    if (!activeJob) {
      // Concurrent staff transaction marked attendance, cancelled booking, or purged in-flight job
      await this.db.reminderJob.deleteMany({ where: { id: job.id } });
      return {
        jobId,
        status: "SKIPPED_VISIT_NOT_CONFIRMED",
        reason: "SiteVisit was completed, cancelled, or purged by concurrent staff action during processing",
      };
    }

    // 7. Dispatch simulated notification
    try {
      const result = await this.notificationProvider({
        recipientPhone: lead.phone,
        recipientName: lead.name,
        reminderType: job.reminderType,
        slotStartsAt: job.siteVisit.slot.startsAt,
        location: job.siteVisit.slot.location,
        leadCode: lead.leadCode,
        idempotencyKey: job.idempotencyKey,
      });

      // Successful dispatch -> status: SENT
      await this.db.reminderJob.update({
        where: { id: job.id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          failureReason: null,
          simulationNote: result.simulationNote,
        },
      });

      return {
        jobId,
        status: "SENT",
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        simulationNote: result.simulationNote,
      };
    } catch (error) {
      // 7. Bounded retry error handling with 5-minute backoff (maxAttempts = 3)
      const errorMessage =
        error instanceof Error ? error.message : "Unknown notification dispatch error";

      if (job.attempts < job.maxAttempts) {
        // Revert to PENDING with 5-minute backoff
        const retryScheduledFor = new Date(now.getTime() + 5 * 60 * 1000);
        const retryNote = `[RETRY_SCHEDULED] Attempt ${job.attempts}/${job.maxAttempts} failed: ${errorMessage} (Next attempt scheduled for ${retryScheduledFor.toISOString()})`;

        await this.db.reminderJob.update({
          where: { id: job.id },
          data: {
            status: ReminderStatus.PENDING,
            scheduledFor: retryScheduledFor,
            failureReason: errorMessage,
            simulationNote: retryNote,
          },
        });

        return {
          jobId,
          status: "RETRIED",
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          reason: errorMessage,
          simulationNote: retryNote,
        };
      } else {
        // Retries exhausted -> mark FAILED
        const exhaustedNote = `[EXHAUSTED] Max attempts reached (${job.attempts}/${job.maxAttempts}): ${errorMessage}`;

        await this.db.reminderJob.update({
          where: { id: job.id },
          data: {
            status: ReminderStatus.FAILED,
            failureReason: errorMessage,
            simulationNote: exhaustedNote,
          },
        });

        return {
          jobId,
          status: "FAILED",
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          reason: errorMessage,
          simulationNote: exhaustedNote,
        };
      }
    }
  }
}
