import { afterAll, describe, expect, it, vi } from "vitest";
import {
  GET as listTickets,
  POST as createTicket,
} from "@/app/api/tickets/route";
import {
  GET as getTicket,
  PATCH as updateTicket,
} from "@/app/api/tickets/[id]/route";
import { POST as closeTicket } from "@/app/api/tickets/[id]/close/route";
import { GET as ticketSummary } from "@/app/api/tickets/summary/route";
import { prisma } from "@/lib/prisma";
import { deleteFakeUsage, deleteTickets, resetFixtures } from "../support/db";
import { TICKETS, actAs, orgId, userId } from "../support/fixtures";
import { call } from "../support/http";
import { signInAs } from "../support/session";

const created: string[] = [];

afterAll(async () => {
  await deleteTickets(created);
  await deleteFakeUsage();
  resetFixtures();
});

const get = (id: string) => call(getTicket, "GET", { params: { id } });
const patch = (id: string, body: unknown) =>
  call(updateTicket, "PATCH", { params: { id }, body });
const close = (id: string) => call(closeTicket, "POST", { params: { id } });
const create = async (body: unknown) => {
  const r = await call(createTicket, "POST", { body });
  if (r.status === 201) created.push(r.json.ticket.id);
  return r;
};

describe("perimeter", () => {
  it("rejects signed-out callers with 401", async () => {
    expect((await call(listTickets, "GET")).status).toBe(401);
    expect((await get(TICKETS.agentOwned)).status).toBe(401);
    expect((await create({ subject: "s", body: "b" })).status).toBe(401);
  });

  it("answers 404 when the caller belongs to no org", async () => {
    signInAs({ id: "user_without_org", email: "nobody@example.test" });
    expect((await call(listTickets, "GET")).status).toBe(404);
    expect((await get(TICKETS.agentOwned)).status).toBe(404);
  });
});

describe("3a GET /api/tickets", () => {
  it("lists only the caller's org for an owner", async () => {
    await actAs("acmeOwner");
    const acme = await orgId("acme");
    const { status, json } = await call(listTickets, "GET", {
      query: { limit: "100" },
    });
    expect(status).toBe(200);
    expect(json.tickets.length).toBeGreaterThanOrEqual(4);
    expect(json.tickets.every((t: { orgId: string }) => t.orgId === acme)).toBe(
      true,
    );
  });

  it("lists the whole org for a viewer", async () => {
    await actAs("acmeViewer");
    const { status, json } = await call(listTickets, "GET", {
      query: { limit: "100" },
    });
    expect(status).toBe(200);
    expect(json.tickets.map((t: { id: string }) => t.id)).toContain(
      TICKETS.otherAgent,
    );
  });

  it("lists only own or assigned tickets for an agent", async () => {
    await actAs("acmeAgent");
    const me = await userId("acmeAgent");
    const { json } = await call(listTickets, "GET", {
      query: { limit: "100" },
    });
    const ids = json.tickets.map((t: { id: string }) => t.id);
    expect(ids).toContain(TICKETS.agentOwned);
    expect(ids).toContain(TICKETS.agentAssigned);
    expect(ids).not.toContain(TICKETS.otherAgent);
    for (const t of json.tickets) {
      expect(t.ownerId === me || t.assigneeId === me).toBe(true);
    }
  });

  it("filters by status", async () => {
    await actAs("acmeOwner");
    const { json } = await call(listTickets, "GET", {
      query: { status: "resolved" },
    });
    expect(json.tickets.map((t: { id: string }) => t.id)).toEqual([
      TICKETS.ownerOnly,
    ]);
  });

  it("pages with a cursor without repeating tickets", async () => {
    await actAs("acmeOwner");
    const first = await call(listTickets, "GET", { query: { limit: "2" } });
    expect(first.json.tickets).toHaveLength(2);
    expect(first.json.nextCursor).toBe(first.json.tickets[1].id);

    const second = await call(listTickets, "GET", {
      query: { limit: "2", cursor: first.json.nextCursor },
    });
    const firstIds = first.json.tickets.map((t: { id: string }) => t.id);
    for (const t of second.json.tickets) expect(firstIds).not.toContain(t.id);
  });

  it("rejects an invalid query with 400", async () => {
    await actAs("acmeOwner");
    expect(
      (await call(listTickets, "GET", { query: { limit: "0" } })).status,
    ).toBe(400);
    expect(
      (await call(listTickets, "GET", { query: { status: "lost" } })).status,
    ).toBe(400);
  });
});

describe("3b GET /api/tickets/[id]", () => {
  it("lets an owner read another agent's ticket", async () => {
    await actAs("acmeOwner");
    const { status, json } = await get(TICKETS.otherAgent);
    expect(status).toBe(200);
    expect(json.ticket.id).toBe(TICKETS.otherAgent);
  });

  it("lets a viewer read an org ticket", async () => {
    await actAs("acmeViewer");
    expect((await get(TICKETS.ownerOnly)).status).toBe(200);
  });

  it("lets an agent read own and assigned tickets", async () => {
    await actAs("acmeAgent");
    expect((await get(TICKETS.agentOwned)).status).toBe(200);
    expect((await get(TICKETS.agentAssigned)).status).toBe(200);
  });

  it("hides another agent's ticket from an agent with 404", async () => {
    await actAs("acmeAgent");
    expect((await get(TICKETS.otherAgent)).status).toBe(404);
  });

  it("includes the owner's and assignee's names", async () => {
    await actAs("acmeAgent");
    const { json } = await get(TICKETS.agentAssigned);
    expect(json.ticket.owner).toEqual({
      name: "Ada Owner",
      email: "owner@acme.test",
    });
    expect(json.ticket.assignee).toEqual({
      name: "Alex Agent",
      email: "agent@acme.test",
    });
  });

  it("hides another org's ticket with 404", async () => {
    await actAs("globexOwner");
    expect((await get(TICKETS.agentOwned)).status).toBe(404);
  });

  it("answers 404 for an id that does not exist", async () => {
    await actAs("acmeOwner");
    expect((await get("tkt_does_not_exist")).status).toBe(404);
  });
});

describe("3c POST /api/tickets", () => {
  it("creates a ticket in the caller's org, ignoring a client orgId", async () => {
    await actAs("acmeAgent");
    const { status, json } = await create({
      subject: "Created by test",
      body: "orgId below must be ignored",
      orgId: await orgId("globex"),
    });
    expect(status).toBe(201);
    expect(json.ticket.orgId).toBe(await orgId("acme"));
    expect(json.ticket.ownerId).toBe(await userId("acmeAgent"));
  });

  it("records a ticket.create audit entry", async () => {
    await actAs("acmeAgent");
    const { json } = await create({ subject: "Audited", body: "b" });
    await vi.waitFor(async () => {
      const entry = await prisma.auditLog.findFirst({
        where: { event: "ticket.create", resourceId: json.ticket.id },
      });
      expect(entry?.actorId).toBe(await userId("acmeAgent"));
    });
  });

  it("accepts an assignee from the same org", async () => {
    await actAs("acmeAgent");
    const assigneeId = await userId("acmeAgent2");
    const { status, json } = await create({
      subject: "s",
      body: "b",
      assigneeId,
    });
    expect(status).toBe(201);
    expect(json.ticket.assigneeId).toBe(assigneeId);
  });

  it("rejects an assignee from another org with 404", async () => {
    await actAs("acmeAgent");
    const assigneeId = await userId("globexAgent");
    expect((await create({ subject: "s", body: "b", assigneeId })).status).toBe(
      404,
    );
  });

  it("rejects an empty body with 400", async () => {
    await actAs("acmeAgent");
    expect((await create({})).status).toBe(400);
  });

  it("forbids viewers and owners from creating (403)", async () => {
    await actAs("acmeViewer");
    expect((await create({ subject: "s", body: "b" })).status).toBe(403);
    await actAs("acmeOwner");
    expect((await create({ subject: "s", body: "b" })).status).toBe(403);
  });
});

describe("3d PATCH /api/tickets/[id]", () => {
  it("lets an agent update their own ticket", async () => {
    await actAs("acmeAgent");
    const { status, json } = await patch(TICKETS.agentOwned, {
      status: "pending",
    });
    expect(status).toBe(200);
    expect(json.ticket.status).toBe("pending");
  });

  it("hides another agent's ticket with 404", async () => {
    await actAs("acmeAgent");
    expect(
      (await patch(TICKETS.otherAgent, { status: "pending" })).status,
    ).toBe(404);
  });

  it("hides another org's ticket with 404 and changes nothing", async () => {
    await actAs("globexAgent");
    expect(
      (await patch(TICKETS.agentOwned, { subject: "hijack" })).status,
    ).toBe(404);
    const row = await prisma.ticket.findUniqueOrThrow({
      where: { id: TICKETS.agentOwned },
    });
    expect(row.subject).toBe("Card declined at checkout");
  });

  it("forbids viewers and owners from updating (403)", async () => {
    await actAs("acmeViewer");
    expect((await patch(TICKETS.agentOwned, { subject: "x" })).status).toBe(
      403,
    );
    await actAs("acmeOwner");
    expect((await patch(TICKETS.agentOwned, { subject: "x" })).status).toBe(
      403,
    );
  });

  it("rejects an empty body with 400", async () => {
    await actAs("acmeAgent");
    expect((await patch(TICKETS.agentOwned, {})).status).toBe(400);
  });

  it("rejects an assignee from another org with 404", async () => {
    await actAs("acmeAgent");
    const assigneeId = await userId("globexAgent");
    expect((await patch(TICKETS.agentOwned, { assigneeId })).status).toBe(404);
  });
});

describe("3e POST /api/tickets/[id]/close", () => {
  it("hides another org's ticket with 404", async () => {
    await actAs("globexAgent");
    expect((await close(TICKETS.agentOwned)).status).toBe(404);
  });

  it("hides another agent's ticket with 404", async () => {
    await actAs("acmeAgent");
    expect((await close(TICKETS.otherAgent)).status).toBe(404);
  });

  it("forbids viewers and owners from closing (403)", async () => {
    await actAs("acmeViewer");
    expect((await close(TICKETS.agentOwned)).status).toBe(403);
    await actAs("acmeOwner");
    expect((await close(TICKETS.agentOwned)).status).toBe(403);
  });

  it("closes a ticket and keeps closedAt when closed again", async () => {
    await actAs("acmeAgent");
    const first = await close(TICKETS.agentOwned);
    expect(first.status).toBe(200);
    expect(first.json.ticket.status).toBe("closed");
    expect(first.json.ticket.closedAt).not.toBeNull();

    const second = await close(TICKETS.agentOwned);
    expect(second.status).toBe(200);
    expect(second.json.ticket.closedAt).toBe(first.json.ticket.closedAt);
  });
});

describe("GET /api/tickets/summary", () => {
  it("rejects signed-out callers with 401", async () => {
    expect((await call(ticketSummary, "GET")).status).toBe(401);
  });

  it("counts only what the caller can see", async () => {
    await actAs("acmeOwner");
    const owner = (await call(ticketSummary, "GET")).json;
    await actAs("acmeAgent");
    const agent = (await call(ticketSummary, "GET")).json;

    const total = (c: Record<string, number>) =>
      c.open + c.pending + c.resolved + c.closed;
    const acmeTickets = await prisma.ticket.count({
      where: { orgId: await orgId("acme") },
    });
    expect(total(owner)).toBe(acmeTickets);
    expect(total(agent)).toBeLessThan(total(owner));
  });
});
