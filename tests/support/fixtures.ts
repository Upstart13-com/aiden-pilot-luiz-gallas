import { prisma } from "@/lib/prisma";
import { signInAs } from "./session";

export const TICKETS = {
  agentOwned: "tkt_acme_agent_owned",
  agentAssigned: "tkt_acme_agent_assigned",
  otherAgent: "tkt_acme_other_agent",
  ownerOnly: "tkt_acme_owner_only",
  globexOwned: "tkt_globex_agent_owned",
} as const;

export const PERSONAS = {
  acmeOwner: "owner@acme.test",
  acmeAgent: "agent@acme.test",
  acmeAgent2: "agent2@acme.test",
  acmeViewer: "viewer@acme.test",
  globexOwner: "owner@globex.test",
  globexAgent: "agent@globex.test",
} as const;

export type Persona = keyof typeof PERSONAS;

export async function userId(persona: Persona): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: PERSONAS[persona] },
  });
  return user.id;
}

export async function orgId(slug: "acme" | "globex"): Promise<string> {
  const org = await prisma.org.findUniqueOrThrow({ where: { slug } });
  return org.id;
}

export async function membershipId(persona: Persona): Promise<string> {
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: await userId(persona) },
  });
  return membership.id;
}

/** Make the mocked `auth()` return this persona's session. */
export async function actAs(persona: Persona | null): Promise<void> {
  signInAs(
    persona ? { id: await userId(persona), email: PERSONAS[persona] } : null
  );
}
