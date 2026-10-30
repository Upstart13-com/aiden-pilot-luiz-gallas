import {
  withRateLimit,
  type AuthHandlerContext,
} from "@upstart13-com/aiden-security";
import { createAIStreamResponse } from "@upstart13-com/aiden-realtime";
import {
  withAuth,
  assertCan,
  auditLog,
  parseRequest,
  RequestValidationError,
} from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { defaultAI } from "@/lib/ai";
import { withAIStreamCall } from "@/lib/ai-usage";
import { requireMembership } from "@/lib/membership";
import { findVisibleTicket } from "@/lib/tickets";
import {
  DRAFT_MAX_TOKENS,
  DRAFT_SYSTEM_PROMPT,
  fenceTicket,
} from "@/lib/prompts";
import { DraftBody, RouteParams } from "@/lib/validation/ticket";

type Params = Promise<{ id: string }>;

export const POST = withAuth<Params>(
  withRateLimit<AuthHandlerContext<Params>>(
    async (req, { session, params }) => {
      const parsed = RouteParams.safeParse(await params);
      if (!parsed.success) throw new RequestValidationError(parsed.error);
      const { id } = parsed.data;
      const { tone } = await parseRequest(req, DraftBody);

      const ctx = await requireMembership(session.user.id);
      const ticket = await findVisibleTicket(id, ctx);
      assertCan(abilities, session, "ai.invoke", ctx);

      const client = await defaultAI();
      const stream = await withAIStreamCall(
        { orgId: ctx.orgId, feature: "ticket.draft" },
        () =>
          client.stream({
            system: DRAFT_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Tone: ${tone}\n\n${fenceTicket(ticket)}`,
              },
            ],
            maxTokens: DRAFT_MAX_TOKENS,
          }),
      );

      auditLog({
        event: "ai.draft",
        resourceId: ticket.id,
        metadata: { orgId: ctx.orgId, tone },
      });
      return createAIStreamResponse(stream, { signal: req.signal });
    },
    {
      limit: 10,
      windowMs: 60_000,
      keyFor: (_req, { session }) => session.user.id,
    },
  ),
);
