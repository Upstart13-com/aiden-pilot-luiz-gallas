import { execSync } from "node:child_process";
import { prisma } from "@/lib/prisma";

/** Re-run the idempotent seed, restoring fixture tickets and memberships. */
export function resetFixtures(): void {
  execSync("npm run db:seed --silent", { stdio: "ignore" });
}

export async function deleteTickets(ids: string[]): Promise<void> {
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
}

/** Remove usage rows written by the fake AI client. */
export async function deleteFakeUsage(): Promise<void> {
  await prisma.aIUsage.deleteMany({ where: { model: "fake-model" } });
}
