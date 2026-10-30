import "server-only";
import { prisma } from "@/lib/prisma";

/** Shared by the admin API routes and the /admin pages. Every query is org-scoped. */

export async function listMembers(orgId: string) {
  const rows = await prisma.membership.findMany({
    where: { orgId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

async function memberIds(orgId: string): Promise<string[]> {
  const members = await prisma.membership.findMany({
    where: { orgId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/** Distinct audit event names recorded for the org, for the event filter. */
export async function listAuditEvents(orgId: string): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: { actorId: { in: await memberIds(orgId) } },
    distinct: ["event"],
    select: { event: true },
    orderBy: { event: "asc" },
  });
  return rows.map((r) => r.event);
}

/**
 * Audit entries whose actor is a member of the org. The SDK's `auditReader`
 * has no tenant filter (gap G2), so this reads the AuditLog table directly.
 */
export async function listAuditEntries(
  orgId: string,
  opts: { event?: string; cursor?: string; limit: number },
) {
  const rows = await prisma.auditLog.findMany({
    where: { actorId: { in: await memberIds(orgId) }, event: opts.event },
    // What the audit table shows; IP, user agent and request id stay server-side.
    select: {
      id: true,
      event: true,
      actorId: true,
      resourceId: true,
      metadata: true,
      timestamp: true,
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, opts.limit);
  const nextCursor = rows.length > opts.limit ? page[page.length - 1].id : null;

  const actors = await prisma.user.findMany({
    where: { id: { in: page.flatMap((e) => (e.actorId ? [e.actorId] : [])) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(actors.map((a) => [a.id, a.email]));
  const entries = page.map((e) => ({
    ...e,
    actorEmail: e.actorId ? (emailById.get(e.actorId) ?? null) : null,
  }));

  return { entries, nextCursor };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getUsageSummary(orgId: string) {
  const org = { orgId };
  const since = new Date(Date.now() - 30 * DAY_MS);
  const sums = {
    _sum: { costUSD: true, totalTokens: true },
    _count: { _all: true },
  } as const;

  const [allTime, last30Days, byFeature, byModel, byUserRows, recent] =
    await Promise.all([
      prisma.aIUsage.aggregate({ where: org, ...sums }),
      prisma.aIUsage.aggregate({
        where: { ...org, createdAt: { gte: since } },
        ...sums,
      }),
      prisma.aIUsage.groupBy({ by: ["feature"], where: org, ...sums }),
      prisma.aIUsage.groupBy({ by: ["model"], where: org, ...sums }),
      prisma.aIUsage.groupBy({ by: ["userId"], where: org, ...sums }),
      prisma.aIUsage.findMany({
        where: org,
        select: {
          id: true,
          feature: true,
          model: true,
          totalTokens: true,
          costUSD: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  const total = (a: typeof allTime) => ({
    costUSD: Number(a._sum.costUSD ?? 0),
    totalTokens: a._sum.totalTokens ?? 0,
    calls: a._count._all,
  });

  const users = await prisma.user.findMany({
    where: {
      id: { in: byUserRows.flatMap((g) => (g.userId ? [g.userId] : [])) },
    },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return {
    totals: { allTime: total(allTime), last30Days: total(last30Days) },
    byFeature: byFeature.map((g) => ({ feature: g.feature, ...total(g) })),
    byModel: byModel.map((g) => ({ model: g.model, ...total(g) })),
    byUser: byUserRows.map((g) => ({
      userId: g.userId,
      email: g.userId ? (emailById.get(g.userId) ?? null) : null,
      ...total(g),
    })),
    recent: recent.map((r) => ({ ...r, costUSD: Number(r.costUSD) })),
  };
}
