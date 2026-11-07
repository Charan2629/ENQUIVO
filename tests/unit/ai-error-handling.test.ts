import { describe, it, expect } from "vitest";
import {
  AIError,
  AITransientError,
  AIRateLimitError,
  AIAuthError,
  AIModelNotFoundError,
  classifyGeminiError,
} from "@/services/ai/ai.service";

describe("AI Error Classification & Transient Recovery (Unit Tests)", () => {
  it("1. classifies HTTP 503 status code as AITransientError with retryable=true", () => {
    const errorWithStatus = Object.assign(new Error("The model is overloaded"), { status: 503 });
    const classified = classifyGeminiError(errorWithStatus);

    expect(classified).toBeInstanceOf(AITransientError);
    expect((classified as AITransientError).status).toBe(503);
    expect((classified as AITransientError).retryable).toBe(true);
    expect(classified.message).toContain("high demand");
  });

  it("2. classifies raw 503 UNAVAILABLE message strings as AITransientError", () => {
    const rawError = new Error("503 UNAVAILABLE: The model models/gemini-3.8-flash is overloaded. Please try again later.");
    const classified = classifyGeminiError(rawError);

    expect(classified).toBeInstanceOf(AITransientError);
    expect((classified as AITransientError).retryable).toBe(true);
    // Crucial: Raw provider JSON / internal model path should NOT be in the buyer-facing message
    expect(classified.message).not.toContain("models/gemini-3.8-flash");
    expect(classified.message).toContain("high demand");
  });

  it("3. classifies transient network dropouts (fetch failed, ECONNRESET, ETIMEDOUT) as AITransientError", () => {
    const networkErrors = [
      new Error("fetch failed"),
      new Error("read ECONNRESET"),
      new Error("connect ETIMEDOUT 142.250.190.42:443"),
      new Error("socket hang up"),
    ];

    for (const err of networkErrors) {
      const classified = classifyGeminiError(err);
      expect(classified).toBeInstanceOf(AITransientError);
      expect((classified as AITransientError).retryable).toBe(true);
    }
  });

  it("4. classifies HTTP 429 and RESOURCE_EXHAUSTED as AIRateLimitError with retryable=true", () => {
    const err1 = Object.assign(new Error("Too Many Requests"), { status: 429 });
    const err2 = new Error("429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'GenerateContent'");

    const classified1 = classifyGeminiError(err1);
    const classified2 = classifyGeminiError(err2);

    expect(classified1).toBeInstanceOf(AIRateLimitError);
    expect((classified1 as AIRateLimitError).status).toBe(429);
    expect((classified1 as AIRateLimitError).retryable).toBe(true);

    expect(classified2).toBeInstanceOf(AIRateLimitError);
    expect((classified2 as AIRateLimitError).retryable).toBe(true);
  });

  it("5. classifies HTTP 401/403 and API_KEY_INVALID as AIAuthError with retryable=false", () => {
    const err1 = Object.assign(new Error("Unauthorized"), { status: 401 });
    const err2 = new Error("API_KEY_INVALID: API key not valid. Please pass a valid API key.");

    const classified1 = classifyGeminiError(err1);
    const classified2 = classifyGeminiError(err2);

    expect(classified1).toBeInstanceOf(AIAuthError);
    expect((classified1 as AIAuthError).retryable).toBe(false);

    expect(classified2).toBeInstanceOf(AIAuthError);
    expect((classified2 as AIAuthError).retryable).toBe(false);
    expect(classified2.message).not.toContain("API key not valid");
  });

  it("6. classifies HTTP 404 and missing/deprecated model errors as AIModelNotFoundError with retryable=false", () => {
    const err1 = Object.assign(new Error("Not Found"), { status: 404 });
    const err2 = new Error("404 NOT_FOUND: This model models/gemini-2.5-flash is no longer available to new users.");

    const classified1 = classifyGeminiError(err1);
    const classified2 = classifyGeminiError(err2);

    expect(classified1).toBeInstanceOf(AIModelNotFoundError);
    expect((classified1 as AIModelNotFoundError).retryable).toBe(false);

    expect(classified2).toBeInstanceOf(AIModelNotFoundError);
    expect((classified2 as AIModelNotFoundError).retryable).toBe(false);
    expect(classified2.message).not.toContain("gemini-2.5-flash");
  });

  it("7. returns already typed AIError instances directly without double-wrapping", () => {
    const existing = new AITransientError("Custom high demand message");
    const classified = classifyGeminiError(existing);

    expect(classified).toBe(existing);
    expect(classified.message).toBe("Custom high demand message");
  });

  it("8. falls back to sanitized AIError for unexpected errors and does not expose stack or secrets", () => {
    const weirdError = new Error("Uncaught reference secret_AI_KEY_xyz at /internal/path/file.ts:42:10");
    const classified = classifyGeminiError(weirdError);

    expect(classified).toBeInstanceOf(AIError);
    expect(classified.message).not.toContain("secret_AI_KEY_xyz");
    expect(classified.message).not.toContain("/internal/path/file.ts");
    expect(classified.message).toContain("unexpected error");
  });
});

