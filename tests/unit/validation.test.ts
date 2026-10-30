import { describe, expect, it } from "vitest";
import { AuditQuery, RoleChangeBody } from "@/lib/validation/admin";
import {
  CreateTicketBody,
  DraftBody,
  ListTicketsQuery,
  UpdateTicketBody,
} from "@/lib/validation/ticket";

describe("ListTicketsQuery", () => {
  it("defaults the limit to 25", () => {
    expect(ListTicketsQuery.parse({}).limit).toBe(25);
  });

  it("accepts limits from 1 to 100 only", () => {
    expect(ListTicketsQuery.safeParse({ limit: "1" }).success).toBe(true);
    expect(ListTicketsQuery.safeParse({ limit: "100" }).success).toBe(true);
    expect(ListTicketsQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(ListTicketsQuery.safeParse({ limit: "101" }).success).toBe(false);
    expect(ListTicketsQuery.safeParse({ limit: "abc" }).success).toBe(false);
  });

  it("rejects unknown status and priority values", () => {
    expect(ListTicketsQuery.safeParse({ status: "lost" }).success).toBe(false);
    expect(ListTicketsQuery.safeParse({ priority: "normal" }).success).toBe(
      false,
    );
  });
});

describe("CreateTicketBody", () => {
  it("requires a subject and body", () => {
    expect(CreateTicketBody.safeParse({}).success).toBe(false);
    expect(
      CreateTicketBody.safeParse({ subject: "s", body: "b" }).success,
    ).toBe(true);
  });

  it("drops an orgId sent by the client", () => {
    const parsed = CreateTicketBody.parse({
      subject: "s",
      body: "b",
      orgId: "x",
    });
    expect(parsed).not.toHaveProperty("orgId");
  });
});

describe("UpdateTicketBody", () => {
  it("requires at least one field", () => {
    expect(UpdateTicketBody.safeParse({}).success).toBe(false);
    expect(UpdateTicketBody.safeParse({ status: "pending" }).success).toBe(
      true,
    );
  });

  it("allows clearing the assignee", () => {
    expect(UpdateTicketBody.safeParse({ assigneeId: null }).success).toBe(true);
  });
});

describe("DraftBody", () => {
  it("defaults the tone and rejects unknown tones", () => {
    expect(DraftBody.parse({}).tone).toBe("neutral");
    expect(DraftBody.safeParse({ tone: "rude" }).success).toBe(false);
  });
});

describe("admin schemas", () => {
  it("accepts only the three roles", () => {
    expect(RoleChangeBody.safeParse({ role: "agent" }).success).toBe(true);
    expect(RoleChangeBody.safeParse({ role: "admin" }).success).toBe(false);
  });

  it("caps the audit page size at 200", () => {
    expect(AuditQuery.parse({}).limit).toBe(50);
    expect(AuditQuery.safeParse({ limit: "201" }).success).toBe(false);
  });
});
