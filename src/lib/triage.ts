import "server-only";
import { z } from "zod";
import type { Ticket } from "@/generated/prisma/client";
import { defaultAI } from "@/lib/ai";
import { withAICall } from "@/lib/ai-usage";
import { log } from "@/lib/logger";
import type { MembershipContext } from "@/lib/membership";
import { prisma } from "@/lib/prisma";
import {
  TRIAGE_MAX_TOKENS,
  TRIAGE_SYSTEM_PROMPT,
  fenceTicket,
} from "@/lib/prompts";

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
    category: { type: "string" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  },
  required: ["priority", "category", "sentiment"],
};

/** The provider's JSON is untrusted input; it is re-validated before it reaches the DB. */
const TriageResult = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1).max(60),
  sentiment: z.enum(["positive", "neutral", "negative"]),
});

/**
 * Classifies a saved ticket and stores the result. Never throws: on a
 * provider or parse failure the ticket is returned as-is with `triagedAt`
 * still null, so a flaky provider never blocks filing a ticket.
 */
export async function triageTicket(
  ticket: Ticket,
  ctx: MembershipContext,
): Promise<Ticket> {
  try {
    const client = await defaultAI();
    const res = await withAICall(
      { orgId: ctx.orgId, feature: "ticket.triage" },
      () =>
        client.complete({
          system: TRIAGE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: fenceTicket(ticket) }],
          responseSchema: TRIAGE_SCHEMA,
          maxTokens: TRIAGE_MAX_TOKENS,
        }),
    );

    const parsed = TriageResult.safeParse(res.parsed);
    if (!parsed.success) {
      log.error(
        { ticketId: ticket.id, issues: parsed.error.issues },
        "triage returned an invalid shape",
      );
      return ticket;
    }

    return await prisma.ticket.update({
      where: { id: ticket.id },
      data: { ...parsed.data, triagedAt: new Date() },
    });
  } catch (err) {
    log.error({ err, ticketId: ticket.id }, "ticket triage failed");
    return ticket;
  }
}
