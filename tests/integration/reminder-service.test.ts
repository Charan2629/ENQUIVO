import { describe, it, expect, afterAll } from "vitest";
import {
  BookingStatus,
  VisitSlotStatus,
  ReminderType,
  ReminderStatus,
  LeadSource,
} from "@prisma/client";
import { ReminderService } from "@/services/reminder/reminder.service";
import { MockNotificationPayload, MockNotificationResult } from "@/services/reminder/mock-notification.provider";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("ReminderService Integration Tests (Isolated Neon Test Branch)", () => {
  const reminderService = new ReminderService(testPrisma);

  // Track created entity IDs for deterministic, safe teardown
  const createdJobIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdSlotIds = new Set<string>();
  const createdLeadIds = new Set<string>();

  const TEST_RUN_ID = Date.now().toString().slice(-6);

  // Helper to create test lead with optional consent
  async function createTestLead(
    name: string,
    phoneSuffix: number,
    consentOptedOut: boolean = false,
    includeConsent: boolean = true
  ) {
    const lead = await testPrisma.lead.create({
      data: {
        leadCode: `LD-RM-${TEST_RUN_ID}-${phoneSuffix.toString().padStart(4, "0")}`,
        name,
        phone: `+9197${TEST_RUN_ID}${phoneSuffix.toString().padStart(4, "0")}`,
        source: LeadSource.WEBSITE,
        ...(includeConsent
          ? {
              consentRecord: {
                create: {
                  consentText: "I agree to receive communications per DPDP Act 2023",
                  consentedAt: new Date(),
                  optedOut: consentOptedOut,
                  optOutAt: consentOptedOut ? new Date() : null,
                },
              },
            }
          : {}),
      },
    });
    createdLeadIds.add(lead.id);
    return lead;
  }

  // Helper to create test slot
  async function createTestSlot(startsAt: Date, endsAt: Date) {
    const slot = await testPrisma.visitSlot.create({
      data: {
        startsAt,
        endsAt,
        status: VisitSlotStatus.BOOKED,
        location: "Enquivo Sales Gallery, Ahmedabad",
      },
    });
    createdSlotIds.add(slot.id);
    return slot;
  }

  // Helper to create test visit
  async function createTestVisit(
    slotId: string,
    leadId: string,
    bookingStatus: BookingStatus = BookingStatus.CONFIRMED
  ) {
    const visit = await testPrisma.siteVisit.create({
      data: {
        slotId,
        leadId,
        bookingStatus,
        bookedAt: new Date(),
      },
    });
    createdVisitIds.add(visit.id);
    return visit;
  }

  // Helper to create test reminder job
  async function createTestReminderJob(
    siteVisitId: string,
    scheduledFor: Date,
    reminderType: ReminderType = ReminderType.REMINDER_24H,
    status: ReminderStatus = ReminderStatus.PENDING,
    attempts: number = 0,
    lastAttemptAt: Date | null = null
  ) {
    const job = await testPrisma.reminderJob.create({
      data: {
        siteVisitId,
        reminderType,
        status,
        scheduledFor,
        idempotencyKey: `${siteVisitId}:${reminderType}:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        attempts,
        maxAttempts: 3,
        lastAttemptAt,
      },
    });
    createdJobIds.add(job.id);
    return job;
  }

  afterAll(async () => {
    const jobIds = Array.from(createdJobIds);
    const visitIds = Array.from(createdVisitIds);
    const slotIds = Array.from(createdSlotIds);
    const leadIds = Array.from(createdLeadIds);

    if (jobIds.length > 0) {
      await testPrisma.reminderJob.deleteMany({ where: { id: { in: jobIds } } });
    }

    if (visitIds.length > 0) {
      await testPrisma.reminderJob.deleteMany({ where: { siteVisitId: { in: visitIds } } });
      await testPrisma.siteVisit.deleteMany({ where: { id: { in: visitIds } } });
    }

    if (slotIds.length > 0) {
      await testPrisma.visitSlot.deleteMany({ where: { id: { in: slotIds } } });
    }

    if (leadIds.length > 0) {
      await testPrisma.consentRecord.deleteMany({ where: { leadId: { in: leadIds } } });
      await testPrisma.leadSourceEvent.deleteMany({ where: { leadId: { in: leadIds } } });
      await testPrisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    }

    await disconnectTestPrisma();
  });

  it("Scenario 1: successfully processes due PENDING reminder and marks SENT with audit note", async () => {
    const lead = await createTestLead("Aarav Mehta", 101, false, true);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slot = await createTestSlot(tomorrow, new Date(tomorrow.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    // Reminder due 5 minutes in the past
    const dueTime = new Date(Date.now() - 5 * 60 * 1000);
    const job = await createTestReminderJob(visit.id, dueTime, ReminderType.REMINDER_24H);

    const result = await reminderService.processDueReminders(20);

    expect(result.processedCount).toBeGreaterThanOrEqual(1);
    const jobResult = result.details.find((d) => d.jobId === job.id);
    expect(jobResult).toBeDefined();
    expect(jobResult?.status).toBe("SENT");

    // Verify DB state
    const updatedJob = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(updatedJob?.status).toBe(ReminderStatus.SENT);
    expect(updatedJob?.sentAt).not.toBeNull();
    expect(updatedJob?.attempts).toBe(1);
    expect(updatedJob?.failureReason).toBeNull();
    expect(updatedJob?.simulationNote).toContain(lead.phone);
    expect(updatedJob?.simulationNote).toContain("[SIMULATED_REMINDER_24H]");
  });

  it("Scenario 2: suppresses dispatch for CANCELLED visits and cleans up reminder job", async () => {
    let mockDispatched = false;
    const trackingProvider = async (payload: MockNotificationPayload): Promise<MockNotificationResult> => {
      mockDispatched = true;
      return {
        success: true,
        messageId: "tracking-id",
        messageText: "Dispatched",
        simulationNote: `Dispatched to ${payload.recipientPhone}`,
      };
    };

    const trackingService = new ReminderService(testPrisma, trackingProvider);

    const lead = await createTestLead("Bhavin Shah", 102, false, true);
    const startsAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    // Visit is CANCELLED
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CANCELLED);

    const dueTime = new Date(Date.now() - 2 * 60 * 1000);
    const job = await createTestReminderJob(visit.id, dueTime, ReminderType.REMINDER_2H);

    const result = await trackingService.processReminderJob(job.id);

    expect(result.status).toBe("SKIPPED_VISIT_NOT_CONFIRMED");
    expect(mockDispatched).toBe(false);

    // Job should be deleted/cleaned up from DB, NEVER marked FAILED
    const dbJob = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(dbJob).toBeNull();
  });

  it("Scenario 3: handles transient failures with 5-minute backoff and exhausts to FAILED after 3 attempts", async () => {
    let callCount = 0;
    const failingProvider = async (): Promise<MockNotificationResult> => {
      callCount++;
      throw new Error(`Transient SMS gateway error (call ${callCount})`);
    };

    const failingService = new ReminderService(testPrisma, failingProvider);

    const lead = await createTestLead("Chirag Dave", 103, false, true);
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    const dueTime = new Date(Date.now() - 10 * 60 * 1000);
    const job = await createTestReminderJob(visit.id, dueTime, ReminderType.REMINDER_24H);

    const beforeAttempt1 = Date.now();
    // Attempt 1: Reverts to PENDING with 5-minute backoff
    const res1 = await failingService.processReminderJob(job.id);
    expect(res1.status).toBe("RETRIED");
    expect(res1.attempts).toBe(1);

    const jobAfterAttempt1 = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(jobAfterAttempt1?.status).toBe(ReminderStatus.PENDING);
    expect(jobAfterAttempt1?.attempts).toBe(1);
    expect(jobAfterAttempt1?.simulationNote).toContain("[RETRY_SCHEDULED] Attempt 1/3");
    // Verify 5-minute backoff: scheduledFor should be set ~5 minutes in future
    expect(jobAfterAttempt1?.scheduledFor.getTime()).toBeGreaterThanOrEqual(beforeAttempt1 + 4 * 60 * 1000);

    // Attempt 2: Reverts to PENDING with 5-minute backoff
    const res2 = await failingService.processReminderJob(job.id);
    expect(res2.status).toBe("RETRIED");
    expect(res2.attempts).toBe(2);

    const jobAfterAttempt2 = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(jobAfterAttempt2?.status).toBe(ReminderStatus.PENDING);
    expect(jobAfterAttempt2?.attempts).toBe(2);
    expect(jobAfterAttempt2?.simulationNote).toContain("[RETRY_SCHEDULED] Attempt 2/3");

    // Attempt 3: Exhausted -> Transitions to FAILED
    const res3 = await failingService.processReminderJob(job.id);
    expect(res3.status).toBe("FAILED");
    expect(res3.attempts).toBe(3);

    const jobAfterAttempt3 = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(jobAfterAttempt3?.status).toBe(ReminderStatus.FAILED);
    expect(jobAfterAttempt3?.attempts).toBe(3);
    expect(jobAfterAttempt3?.simulationNote).toContain("[EXHAUSTED] Max attempts reached (3/3)");
    expect(jobAfterAttempt3?.failureReason).toContain("Transient SMS gateway error");
  });

  it("Scenario 4: enforces atomic claiming under concurrency (only 1 worker delivers, 1 skips)", async () => {
    let dispatchCount = 0;
    const concurrentProvider = async (payload: MockNotificationPayload): Promise<MockNotificationResult> => {
      dispatchCount++;
      // Small simulated delay to increase race overlap window
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        success: true,
        messageId: `msg-${dispatchCount}`,
        messageText: "Concurrent delivery",
        simulationNote: `Delivered to ${payload.recipientPhone}`,
      };
    };

    const worker1 = new ReminderService(testPrisma, concurrentProvider);
    const worker2 = new ReminderService(testPrisma, concurrentProvider);

    const lead = await createTestLead("Dhara Patel", 104, false, true);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    const dueTime = new Date(Date.now() - 5 * 60 * 1000);
    const job = await createTestReminderJob(visit.id, dueTime, ReminderType.REMINDER_24H);

    // Launch both workers simultaneously against the same job
    const [result1, result2] = await Promise.all([
      worker1.processReminderJob(job.id),
      worker2.processReminderJob(job.id),
    ]);

    const statuses = [result1.status, result2.status].sort();
    expect(statuses).toEqual(["SENT", "SKIPPED_ALREADY_CLAIMED"]);
    expect(dispatchCount).toBe(1);

    const finalJob = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(finalJob?.status).toBe(ReminderStatus.SENT);
    expect(finalJob?.attempts).toBe(1);
  });

  it("Scenario 5: suppresses dispatch and deletes job when lead has opted out per DPDP Act", async () => {
    let providerCalled = false;
    const nonCallingProvider = async (): Promise<MockNotificationResult> => {
      providerCalled = true;
      return {
        success: true,
        messageId: "never-called",
        messageText: "",
        simulationNote: "",
      };
    };

    const dpdpService = new ReminderService(testPrisma, nonCallingProvider);

    // Lead explicitly opted out (optedOut: true)
    const lead = await createTestLead("Esha Trivedi", 105, true, true);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    const dueTime = new Date(Date.now() - 5 * 60 * 1000);
    const job = await createTestReminderJob(visit.id, dueTime, ReminderType.REMINDER_24H);

    const result = await dpdpService.processReminderJob(job.id);

    expect(result.status).toBe("SKIPPED_OPTED_OUT");
    expect(providerCalled).toBe(false);

    // Job must be deleted from operational queue, NEVER marked FAILED
    const dbJob = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(dbJob).toBeNull();
  });

  it("Scenario 6: suppresses dispatch and deletes job when lead lacks digital consent record", async () => {
    let providerCalled = false;
    const nonCallingProvider = async (): Promise<MockNotificationResult> => {
      providerCalled = true;
      return {
        success: true,
        messageId: "never-called",
        messageText: "",
        simulationNote: "",
      };
    };

    const dpdpService = new ReminderService(testPrisma, nonCallingProvider);

    // Lead with NO consentRecord
    const lead = await createTestLead("Farhan Khan", 106, false, false);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    const dueTime = new Date(Date.now() - 5 * 60 * 1000);
    const job = await createTestReminderJob(visit.id, dueTime, ReminderType.REMINDER_24H);

    const result = await dpdpService.processReminderJob(job.id);

    expect(result.status).toBe("SKIPPED_NO_CONSENT");
    expect(providerCalled).toBe(false);

    // Job must be deleted from operational queue, NEVER marked FAILED
    const dbJob = await testPrisma.reminderJob.findUnique({ where: { id: job.id } });
    expect(dbJob).toBeNull();
  });

  it("Scenario 7: reclaims stale PROCESSING jobs with attempts below 3 back to PENDING", async () => {
    const lead = await createTestLead("Gaurav Sen", 107, false, true);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    // Stale PROCESSING job: worker crashed 15 minutes ago, attempts = 1
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const staleJob = await createTestReminderJob(
      visit.id,
      fifteenMinutesAgo,
      ReminderType.REMINDER_24H,
      ReminderStatus.PROCESSING,
      1,
      fifteenMinutesAgo
    );

    // Run processDueReminders - the recovery sweep runs at the start
    await reminderService.processDueReminders(20);

    const reclaimedJob = await testPrisma.reminderJob.findUnique({ where: { id: staleJob.id } });
    // In our implementation, stale recovery sets it to PENDING, then because scheduledFor is in the past,
    // the subsequent due query picks it up and processes it to SENT!
    expect(reclaimedJob?.status).toBe(ReminderStatus.SENT);
    expect(reclaimedJob?.attempts).toBe(2); // 1 prior + 1 successful claim
  });

  it("Scenario 8: exhausts stale PROCESSING jobs with attempts >= 3 to FAILED", async () => {
    const lead = await createTestLead("Hiten Vora", 108, false, true);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
    const visit = await createTestVisit(slot.id, lead.id, BookingStatus.CONFIRMED);

    // Stale PROCESSING job: worker crashed 15 minutes ago, but attempts already at max (3)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const exhaustedJob = await createTestReminderJob(
      visit.id,
      fifteenMinutesAgo,
      ReminderType.REMINDER_24H,
      ReminderStatus.PROCESSING,
      3,
      fifteenMinutesAgo
    );

    // Run processDueReminders
    await reminderService.processDueReminders(20);

    const finalJob = await testPrisma.reminderJob.findUnique({ where: { id: exhaustedJob.id } });
    expect(finalJob?.status).toBe(ReminderStatus.FAILED);
    expect(finalJob?.failureReason).toContain("Worker timeout");
  });
});
