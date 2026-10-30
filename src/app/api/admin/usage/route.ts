import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = withAuth(async (_req, { session }) => {
  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.usage.read", ctx);

  const org = { orgId: ctx.orgId };
  const since = new Date(Date.now() - 30 * DAY_MS);
  const sums = {
    _sum: { costUSD: true, totalTokens: true },
    _count: { _all: true },
  } as const;

  const [allTime, last30Days, byFeature, byModel, recent] = await Promise.all([
    prisma.aIUsage.aggregate({ where: org, ...sums }),
    prisma.aIUsage.aggregate({
      where: { ...org, createdAt: { gte: since } },
      ...sums,
    }),
    prisma.aIUsage.groupBy({ by: ["feature"], where: org, ...sums }),
    prisma.aIUsage.groupBy({ by: ["model"], where: org, ...sums }),
    prisma.aIUsage.findMany({
      where: org,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const total = (a: typeof allTime) => ({
    costUSD: Number(a._sum.costUSD ?? 0),
    totalTokens: a._sum.totalTokens ?? 0,
    calls: a._count._all,
  });

  return NextResponse.json({
    totals: { allTime: total(allTime), last30Days: total(last30Days) },
    byFeature: byFeature.map((g) => ({ feature: g.feature, ...total(g) })),
    byModel: byModel.map((g) => ({ model: g.model, ...total(g) })),
    recent: recent.map((r) => ({ ...r, costUSD: Number(r.costUSD) })),
  });
});
