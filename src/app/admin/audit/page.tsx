import { PageHeader } from "@upstart13-com/aiden-ui";
import { AuditLogTable } from "@upstart13-com/aiden-ui/components/audit-log-table";
import { EventFilter } from "@/components/admin/event-filter";
import { listAuditEntries, listAuditEvents } from "@/lib/admin";
import { getPageContext } from "@/lib/page-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { ctx } = await getPageContext("/admin/audit");
  const { event } = await searchParams;
  const [{ entries }, events] = await Promise.all([
    listAuditEntries(ctx.orgId, { event, limit: 100 }),
    listAuditEvents(ctx.orgId),
  ]);

  // The table shows `actorId` as-is; show the actor's email instead.
  const actors = await prisma.user.findMany({
    where: {
      id: { in: entries.flatMap((e) => (e.actorId ? [e.actorId] : [])) },
    },
    select: { id: true, email: true },
  });
  const emailById = new Map(actors.map((a) => [a.id, a.email]));
  const rows = entries.map((e) => ({
    ...e,
    actorId: e.actorId ? (emailById.get(e.actorId) ?? e.actorId) : null,
    metadata: e.metadata as Record<string, unknown> | null,
  }));

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="The latest 100 actions and denied requests by members of your organization."
      />
      <div className="space-y-4 px-6 py-8">
        <EventFilter events={events} current={event} />
        <AuditLogTable
          entries={rows}
          emptyState={
            event
              ? `No "${event}" events yet.`
              : "No activity yet. Ticket changes, role changes and denied requests will appear here."
          }
        />
      </div>
    </div>
  );
}
