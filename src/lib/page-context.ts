import "server-only";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findMembership } from "@/lib/membership";

/** Session + membership for a page; signed-out users go to login, no-org users get a 404. */
export async function getPageContext(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${callbackUrl}`);

  const ctx = await findMembership(session.user.id);
  if (!ctx) notFound();

  return { session, ctx };
}
