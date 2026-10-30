import type { z } from "zod";
import type { UpdateTicketBody } from "@/lib/validation/ticket";

type TicketUpdate = z.output<typeof UpdateTicketBody>;

export type PatchResult =
  | { ok: true; ticket: { id: string; triagedAt: string | null } }
  | { ok: false; message: string };

/** `PATCH /api/tickets/[id]` with a user-facing message for each failure. */
export async function patchTicket(
  ticketId: string,
  update: TicketUpdate,
): Promise<PatchResult> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (res.ok) return { ok: true, ...(await res.json()) };

  switch (res.status) {
    case 400:
      return {
        ok: false,
        message: "Some values weren't accepted. Check them and try again.",
      };
    case 403:
      return { ok: false, message: "Your role can't change tickets." };
    case 404:
      return {
        ok: false,
        message:
          "This ticket, or the person you picked, is no longer available to you.",
      };
    default:
      return {
        ok: false,
        message: `The server answered ${res.status}. Try again in a moment.`,
      };
  }
}
