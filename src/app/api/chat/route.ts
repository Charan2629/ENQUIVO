import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AIConciergeService,
  AIConversationNotFoundError,
  AISecurityError,
} from "@/services/ai/ai.service";
import { chatInputSchema } from "@/lib/validations/ai";

/**
 * Inbound buyer chat endpoint for ENQUIVO AI Concierge.
 * Processes conversation turns, grounds answers in verified facts, and handles handoffs.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = chatInputSchema.parse(body);

    const aiService = new AIConciergeService();
    const result = await aiService.sendMessage(validated);

    return NextResponse.json({
      success: true,
      userMessage: result.userMessage,
      aiMessage: result.aiMessage,
      groundingFactIds: result.groundingFactIds,
      handoffCreated: result.handoffCreated,
      handoff: result.handoff,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof AIConversationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof AISecurityError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Internal AI Concierge error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
