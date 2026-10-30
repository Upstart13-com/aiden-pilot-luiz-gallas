import "server-only";
import { notFound } from "next/navigation";
import type { SecuritySession } from "@upstart13-com/aiden-security";
import { abilities } from "@/lib/abilities";
import { apiGet } from "@/lib/api-client";
import type { MeResponse } from "@/lib/api-types";

/** The signed-in user, from `GET /api/me`. Signed-out callers are sent to login. */
export function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>("/api/me");
}

/**
 * Whether the user may perform an org action. Only for deciding what to
 * render: the API routes enforce the same abilities on every request.
 */
export function viewerCan(me: MeResponse, action: string): boolean {
  const session: SecuritySession = {
    user: { id: me.id, email: me.email, name: me.name, image: me.image, roles: [] },
  };
  return abilities.can(session, action, me.membership ?? undefined);
}

/** For pages inside an org: users with no membership get a 404. */
export async function getViewer() {
  const me = await getMe();
  if (!me.membership) notFound();
  return { me, membership: me.membership };
}
