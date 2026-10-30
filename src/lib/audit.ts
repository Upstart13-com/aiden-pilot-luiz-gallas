import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { headers } from "next/headers";
import {
  createAuditReader,
  createPrismaAuditSink,
  setAuditSink,
  type AuditSink,
} from "@upstart13-com/aiden-security";
import { aidenConfig } from "@/../aiden.config";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Prisma-backed sink: events from routes, `aiden-auth` (sign-in, sign-out,
 * register) and `aiden-security` (ownership / ability failures) land in the
 * `audit_logs` table, which the owner's audit viewer reads.
 *
 * `captureRequestMeta` reads from Next.js's per-request `headers()`
 * helper. It returns `{}` outside a request (e.g. background jobs)
 * because `headers()` throws there — the sink falls back to nulls.
 */
const prismaSink = createPrismaAuditSink({
  prisma,
  captureRequestMeta: () => {
    try {
      const h = headers() as unknown as Headers;
      return {
        ipAddress:
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get("x-real-ip") ??
          null,
        userAgent: h.get("user-agent") ?? null,
      };
    } catch {
      return {};
    }
  },
});

/**
 * JSON Lines sink: one event per line in `AUDIT_LOG_FILE`
 * (default `logs/audit.jsonl`), for a customer that keeps its own audit
 * store and retention (D7). The in-app audit viewer reads `audit_logs`, so
 * it shows nothing while this sink is selected.
 */
const auditFile = process.env.AUDIT_LOG_FILE ?? "logs/audit.jsonl";
const fileSink: AuditSink = async (record) => {
  try {
    await mkdir(dirname(auditFile), { recursive: true });
    await appendFile(auditFile, `${JSON.stringify(record)}\n`);
  } catch (err) {
    log.error({ err, event: record.event }, "failed to write audit event");
  }
};

/**
 * `audit.sink` in aiden.config.ts picks where audit events go. Widened to
 * string here because `aiden doctor` parses the config as a plain literal
 * and rejects a type cast there.
 */
const sink: string = aidenConfig.audit.sink;
setAuditSink(sink === "file" ? fileSink : prismaSink);

export const auditReader = createAuditReader({ prisma });
