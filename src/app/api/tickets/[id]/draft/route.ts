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
import { assertTicketVisible } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { DraftBody, RouteParams } from "@/lib/validation/ticket";

type Params = Promise<{ id: string }>;

const DRAFT_SYSTEM_PROMPT =
  "You are a support agent drafting a reply to a customer. Write only the " +
  "reply body: no subject line, no placeholders, no internal notes.";

export const POST = withAuth<Params>(
  withRateLimit<AuthHandlerContext<Params>>(
    async (req, { session, params }) => {
      const parsed = RouteParams.safeParse(await params);
      if (!parsed.success) throw new RequestValidationError(parsed.error);
      const { id } = parsed.data;
      const { tone } = await parseRequest(req, DraftBody);

      const ctx = await requireMembership(session.user.id);
      assertCan(abilities, session, "ai.invoke", ctx);

      const ticket = await prisma.ticket.findFirst({
        where: { id, orgId: ctx.orgId },
      });
      assertTicketVisible(ticket, ctx);

      const client = await defaultAI();
      const stream = await withAIStreamCall(
        { orgId: ctx.orgId, feature: "ticket.draft" },
        () =>
          client.stream({
            system: DRAFT_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Tone: ${tone}\n\nSubject: ${ticket.subject}\n\n${ticket.body}`,
              },
            ],
          }),
      );

      auditLog({
        event: "ticket.draft_requested",
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
