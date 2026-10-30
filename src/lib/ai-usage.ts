import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { setAIUsageSink } from "@upstart13-com/aiden-logging";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

type AICallMeta = { orgId: string; feature: "ticket.draft" | "ticket.triage" };

const aiCallContext = new AsyncLocalStorage<AICallMeta>();

/**
 * Tags every AI usage record fired inside `fn` with the org and feature.
 * The SDK's usage record has no field for them, so they travel in an
 * async context that the sink below reads.
 */
export function withAICall<T>(
  meta: AICallMeta,
  fn: () => Promise<T>,
): Promise<T> {
  return aiCallContext.run(meta, fn);
}

setAIUsageSink(async (record) => {
  const meta = aiCallContext.getStore();
  try {
    await prisma.aIUsage.create({
      data: { ...record, orgId: meta?.orgId, feature: meta?.feature },
    });
  } catch (err) {
    log.error({ err }, "failed to persist AI usage");
  }
});

/**
 * `withAICall` for streams. Providers record usage in `finalResponse()`,
 * which the SSE response calls after the route has returned, outside the
 * call context, so it is bound back to that context here.
 */
export function withAIStreamCall<
  S extends { finalResponse(): Promise<unknown> },
>(meta: AICallMeta, open: () => Promise<S>): Promise<S> {
  return aiCallContext.run(meta, async () => {
    const stream = await open();
    const runInCallContext = AsyncLocalStorage.snapshot();
    const finalResponse = stream.finalResponse.bind(stream);
    return Object.assign(stream, {
      finalResponse: () => runInCallContext(finalResponse),
    });
  });
}
