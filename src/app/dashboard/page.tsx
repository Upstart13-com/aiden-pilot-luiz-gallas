import Link from "next/link";
import { Inbox } from "lucide-react";
import {
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@upstart13-com/aiden-ui";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";
import { PriorityBadge, StatusBadge } from "@/components/tickets/ticket-badges";
import { abilities } from "@/lib/abilities";
import { formatDate, formatNumber } from "@/lib/format";
import { getPageContext } from "@/lib/page-context";
import { prisma } from "@/lib/prisma";
import { ticketVisibilityWhere } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const { session, ctx } = await getPageContext("/dashboard");
  const where = ticketVisibilityWhere(ctx);

  const [tickets, byStatus, urgent] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    prisma.ticket.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.ticket.count({
      where: { ...where, priority: "urgent", status: { not: "closed" } },
    }),
  ]);

  const count = (status: string) =>
    byStatus.find((s) => s.status === status)?._count._all ?? 0;
  const canCreate = abilities.can(session as never, "ticket.create", ctx);

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={
          ctx.role === "agent"
            ? "Tickets you opened or that are assigned to you."
            : "Every ticket in your organization."
        }
        action={canCreate ? <NewTicketDialog /> : undefined}
      />

      <div className="space-y-8 px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Open"
            value={formatNumber(count("open"))}
            caption="Waiting on your team"
          />
          <MetricCard
            label="Pending"
            value={formatNumber(count("pending"))}
            caption="Waiting on the customer"
          />
          <MetricCard
            label="Resolved"
            value={formatNumber(count("resolved"))}
            caption="Solved, not yet closed"
          />
          <MetricCard
            label="Urgent"
            value={formatNumber(urgent)}
            caption="Urgent and still active"
          />
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent tickets</h2>
          {tickets.length === 0 ? (
            <div className="border-border rounded-sm border">
              <EmptyState
                icon={Inbox}
                title="No tickets yet"
                description={
                  canCreate
                    ? "File the first customer issue and AI triage will prioritize it for you."
                    : "Tickets filed by your organization's agents will appear here."
                }
                action={canCreate ? <NewTicketDialog /> : undefined}
              />
            </div>
          ) : (
            <div className="border-border rounded-sm border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead className="text-foreground font-semibold">
                      Subject
                    </TableHead>
                    <TableHead className="text-foreground font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="text-foreground hidden font-semibold sm:table-cell">
                      Priority
                    </TableHead>
                    <TableHead className="text-foreground hidden font-semibold md:table-cell">
                      Opened
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell className="max-w-0 w-full">
                        <Link
                          href={`/dashboard/tickets/${t.id}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {t.subject}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {t.triagedAt
                            ? (t.category ?? "Uncategorized")
                            : "Not triaged"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <PriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                        {formatDate(t.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
