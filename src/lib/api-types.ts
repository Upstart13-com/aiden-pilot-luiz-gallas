import type { MembershipRole, Ticket } from "@/generated/prisma/client";

/** Response bodies of the API routes the pages read. JSON carries dates as ISO strings. */

type Json<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

type Person = { name: string | null; email: string };

export type TicketJson = Json<Ticket>;

export type MeResponse = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: string | null;
  createdAt: string;
  hasPassword: boolean;
  accounts: { provider: string; providerAccountId: string; type: string }[];
  roles: { name: string; description: string | null }[];
  membership: { orgId: string; orgName: string; role: MembershipRole } | null;
};

export type SigninsResponse = {
  signins: {
    id: string;
    timestamp: string;
    ipAddress: string | null;
    userAgent: string | null;
  }[];
};

export type TicketListResponse = {
  tickets: TicketJson[];
  nextCursor: string | null;
};

export type TicketSummaryResponse = {
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  urgent: number;
};

export type TicketDetailResponse = {
  ticket: TicketJson & { owner: Person; assignee: Person | null };
};

export type MembersResponse = {
  members: {
    id: string;
    userId: string;
    name: string | null;
    email: string;
    role: MembershipRole;
    createdAt: string;
  }[];
};

export type OrgMembersResponse = {
  members: {
    userId: string;
    name: string | null;
    email: string;
    role: MembershipRole;
  }[];
};

export type AuditResponse = {
  entries: {
    id: string;
    event: string;
    actorId: string | null;
    actorEmail: string | null;
    resourceId: string | null;
    metadata: Record<string, unknown> | null;
    timestamp: string;
  }[];
  nextCursor: string | null;
  events: string[];
};

type Spend = { costUSD: number; totalTokens: number; calls: number };

export type UsageResponse = {
  totals: { allTime: Spend; last30Days: Spend };
  byFeature: (Spend & { feature: string | null })[];
  byModel: (Spend & { model: string })[];
  byUser: (Spend & { userId: string | null; email: string | null })[];
  recent: {
    id: string;
    feature: string | null;
    model: string;
    totalTokens: number;
    costUSD: number;
    createdAt: string;
  }[];
};
