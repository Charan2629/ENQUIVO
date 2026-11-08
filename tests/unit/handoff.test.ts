import { describe, it, expect } from "vitest";
import { UserRole, HandoffStatus, EscalationReason } from "@prisma/client";
import {
  getStaffHandoffScope,
  HandoffNotFoundError,
  InvalidAssigneeError,
  HandoffForbiddenError,
} from "@/services/handoff/handoff.service";
import {
  handoffQuerySchema,
  assignHandoffSchema,
  updateHandoffStatusSchema,
} from "@/lib/validations/handoff";
import {
  isInternalAuditMessage,
  filterBuyerFacingMessages,
} from "@/lib/chat-message";

describe("Handoff Queue & Assignment Unit Tests (Milestone 6.3)", () => {
  describe("getStaffHandoffScope", () => {
    it("1. returns unrestricted empty filter for SALES_HEAD", () => {
      const scope = getStaffHandoffScope({
        id: "head-user-123",
        role: UserRole.SALES_HEAD,
      });
      expect(scope).toEqual({});
    });

    it("2. returns relational assignedToId filter for SALES_EXEC", () => {
      const execId = "exec-user-456";
      const scope = getStaffHandoffScope({
        id: execId,
        role: UserRole.SALES_EXEC,
      });
      expect(scope).toEqual({ assignedToId: execId });
    });

    it("3. throws HandoffForbiddenError for non-staff role (BUYER)", () => {
      expect(() =>
        getStaffHandoffScope({
          id: "buyer-user-789",
          role: UserRole.BUYER,
        })
      ).toThrow(HandoffForbiddenError);
    });
  });

  describe("handoffQuerySchema validation", () => {
    it("4. applies default values when query params are omitted", () => {
      const parsed = handoffQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.status).toBe("ALL");
      expect(parsed.reason).toBe("ALL");
      expect(parsed.assignedToId).toBeUndefined();
      expect(parsed.sortBy).toBe("createdAt");
      expect(parsed.sortOrder).toBe("desc");
      expect(parsed.search).toBeUndefined();
    });

    it("5. validates and accepts valid status filters", () => {
      const statuses = ["ALL", "UNASSIGNED", "PENDING", "ASSIGNED", "RESOLVED"];
      for (const st of statuses) {
        const parsed = handoffQuerySchema.parse({ status: st });
        expect(parsed.status).toBe(st);
      }
    });

    it("6. rejects invalid status filter value", () => {
      const result = handoffQuerySchema.safeParse({ status: "INVALID_STATUS" });
      expect(result.success).toBe(false);
    });

    it("7. validates and accepts all valid escalation reasons", () => {
      const reasons = [
        "ALL",
        EscalationReason.PRICE_NEGOTIATION,
        EscalationReason.MISSING_PROJECT_INFO,
        EscalationReason.UNLISTED_AMENITY,
        EscalationReason.BUYER_REQUESTED,
        EscalationReason.OTHER,
      ];
      for (const r of reasons) {
        const parsed = handoffQuerySchema.parse({ reason: r });
        expect(parsed.reason).toBe(r);
      }
    });

    it("8. rejects invalid escalation reason", () => {
      const result = handoffQuerySchema.safeParse({ reason: "RANDOM_REASON" });
      expect(result.success).toBe(false);
    });

    it("9. coerces numeric strings for page and limit", () => {
      const parsed = handoffQuerySchema.parse({ page: "3", limit: "25" });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(25);
    });

    it("10. rejects negative or zero page", () => {
      const result = handoffQuerySchema.safeParse({ page: "0" });
      expect(result.success).toBe(false);
    });

    it("11. rejects limit exceeding 50", () => {
      const result = handoffQuerySchema.safeParse({ limit: "51" });
      expect(result.success).toBe(false);
    });

    it("12. trims search parameter", () => {
      const parsed = handoffQuerySchema.parse({ search: "  Hardik Patel  " });
      expect(parsed.search).toBe("Hardik Patel");
    });
  });

  describe("assignHandoffSchema validation", () => {
    it("13. parses valid salesExecId string", () => {
      const parsed = assignHandoffSchema.parse({ salesExecId: "user_cuid_123" });
      expect(parsed.salesExecId).toBe("user_cuid_123");
    });

    it("14. rejects empty salesExecId", () => {
      const result = assignHandoffSchema.safeParse({ salesExecId: "" });
      expect(result.success).toBe(false);
    });

    it("15. rejects missing salesExecId", () => {
      const result = assignHandoffSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("updateHandoffStatusSchema validation", () => {
    it("16. accepts valid HandoffStatus enum values", () => {
      const statuses = [
        HandoffStatus.PENDING,
        HandoffStatus.ASSIGNED,
        HandoffStatus.RESOLVED,
      ];
      for (const st of statuses) {
        const parsed = updateHandoffStatusSchema.parse({ status: st });
        expect(parsed.status).toBe(st);
      }
    });

    it("17. rejects invalid handoff status", () => {
      const result = updateHandoffStatusSchema.safeParse({ status: "UNKNOWN" });
      expect(result.success).toBe(false);
    });
  });

  describe("Custom Domain Error Classes", () => {
    it("18. constructs HandoffNotFoundError with correct name and message", () => {
      const err = new HandoffNotFoundError("Custom not found");
      expect(err.name).toBe("HandoffNotFoundError");
      expect(err.message).toBe("Custom not found");
      expect(err instanceof Error).toBe(true);
    });

    it("19. constructs InvalidAssigneeError with correct name and message", () => {
      const err = new InvalidAssigneeError("Target user does not currently hold the SALES_EXEC role");
      expect(err.name).toBe("InvalidAssigneeError");
      expect(err.message).toBe("Target user does not currently hold the SALES_EXEC role");
      expect(err instanceof Error).toBe(true);
    });

    it("20. constructs HandoffForbiddenError with correct name and message", () => {
      const err = new HandoffForbiddenError("Permission denied");
      expect(err.name).toBe("HandoffForbiddenError");
      expect(err.message).toBe("Permission denied");
      expect(err instanceof Error).toBe(true);
    });
  });

  describe("Internal Assignment Audit Message Filtering & Isolation", () => {
    it("21. identifies internal assignment audit messages when BOTH role is AI and content has recognized prefix", () => {
      expect(
        isInternalAuditMessage({
          role: "AI",
          content: "[Ownership Assigned] Lead assigned to Vikram Mehta (vikram@enquivo.in) by Rajesh Verma.",
        })
      ).toBe(true);
      expect(
        isInternalAuditMessage(
          "[Ownership Reassigned] Lead reassigned to Priya Sharma by Rajesh Verma.",
          "AI"
        )
      ).toBe(true);
      expect(
        isInternalAuditMessage({
          role: "AI",
          content: "[ASSIGNMENT AUDIT] Handoff assigned to Vikram Mehta.",
        })
      ).toBe(true);
      expect(isInternalAuditMessage({ role: "AI", content: "[AUDIT] System note." })).toBe(true);
    });

    it("22. strictly rejects USER messages as audit records even if their content begins with an audit prefix (anti-spoofing)", () => {
      expect(
        isInternalAuditMessage({
          role: "USER",
          content: "[Ownership Assigned] Can I speak to Vikram directly?",
        })
      ).toBe(false);
      expect(
        isInternalAuditMessage(
          "[Ownership Reassigned] I was talking to someone else earlier.",
          "USER"
        )
      ).toBe(false);
      expect(
        isInternalAuditMessage({
          role: "USER",
          content: "[ASSIGNMENT AUDIT] What does this mean?",
        })
      ).toBe(false);
      expect(isInternalAuditMessage("[AUDIT] Note from buyer", "USER")).toBe(false);
    });

    it("23. does not misclassify legitimate buyer or AI conversational turns as audit messages", () => {
      expect(isInternalAuditMessage({ role: "USER", content: "Can you provide a discount on the 3 BHK unit?" })).toBe(false);
      expect(
        isInternalAuditMessage({
          role: "AI",
          content: "Prakriti Heights offers premium residential units across 420 apartments.",
        })
      ).toBe(false);
      expect(isInternalAuditMessage("What is the ownership structure of the project?", "AI")).toBe(false);
      expect(isInternalAuditMessage("")).toBe(false);
      expect(isInternalAuditMessage(null)).toBe(false);
      expect(isInternalAuditMessage(undefined)).toBe(false);
      // Content without explicit AI role defaults to false
      expect(isInternalAuditMessage("[Ownership Assigned] Missing role")).toBe(false);
    });

    it("24. filterBuyerFacingMessages strips genuine AI audit records while strictly preserving USER messages with audit prefixes and dialogue turns", () => {
      const mixed = [
        { id: "1", role: "USER", content: "Is EV charging available?" },
        { id: "2", role: "AI", content: "Let me check with a sales manager." },
        {
          id: "3",
          role: "AI",
          content: "[Ownership Assigned] Lead assigned to Vikram Mehta by Rajesh Verma.",
        },
        {
          id: "4",
          role: "USER",
          content: "[Ownership Assigned] Why was my inquiry reassigned? Just asking.",
        },
        { id: "5", role: "USER", content: "Thank you!" },
        {
          id: "6",
          role: "AI",
          content: "[Ownership Reassigned] Lead reassigned to Priya Sharma by Rajesh Verma.",
        },
      ];

      const filtered = filterBuyerFacingMessages(mixed);

      expect(filtered).toHaveLength(4);
      expect(filtered.map((m) => m.id)).toEqual(["1", "2", "4", "5"]);
      // Confirm the user message with prefix was NOT stripped
      expect(filtered.find((m) => m.id === "4")?.content).toBe(
        "[Ownership Assigned] Why was my inquiry reassigned? Just asking."
      );
      // Confirm AI audit turns WERE stripped
      expect(filtered.some((m) => m.id === "3")).toBe(false);
      expect(filtered.some((m) => m.id === "6")).toBe(false);
    });
  });
});
