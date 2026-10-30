import { PageHeader } from "@upstart13-com/aiden-ui";
import { AuditLogTable } from "@upstart13-com/aiden-ui/components/audit-log-table";
import { EventFilter } from "@/components/admin/event-filter";
import { apiGet } from "@/lib/api-client";
import type { AuditResponse } from "@/lib/api-types";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event } = await searchParams;
  const query = new URLSearchParams({ limit: "100" });
  if (event) query.set("event", event);
  const { entries, events } = await apiGet<AuditResponse>(
    `/api/admin/audit?${query}`,
  );

  // The table shows `actorId` as-is; show the actor's email instead.
  const rows = entries.map((e) => ({
    ...e,
    actorId: e.actorEmail ?? e.actorId,
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
