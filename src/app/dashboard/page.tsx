import Link from "next/link";
import { ChevronRight, Inbox, SearchX } from "lucide-react";
import {
  Button,
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
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { apiGet } from "@/lib/api-client";
import type {
  OrgMembersResponse,
  TicketListResponse,
  TicketSummaryResponse,
} from "@/lib/api-types";
import { formatDate, formatNumber } from "@/lib/format";
import { getViewer, viewerCan } from "@/lib/page-context";

export const dynamic = "force-dynamic";

const PAGE_SIZE = "25";
const STATUSES = new Set(["open", "pending", "resolved", "closed"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assignee?: string;
    cursor?: string;
  }>;
}) {
  const { status, priority, assignee, cursor } = await searchParams;
  const { members } = await apiGet<OrgMembersResponse>("/api/members");
  const assignees = Object.fromEntries(
    members.map((m) => [m.userId, m.name ?? m.email]),
  );

  // Unknown filter values from the URL are ignored rather than sent on.
  const filters = new URLSearchParams();
  if (status && STATUSES.has(status)) filters.set("status", status);
  if (priority && PRIORITIES.has(priority)) filters.set("priority", priority);
  if (assignee && (assignee === "unassigned" || assignee in assignees)) {
    filters.set("assignee", assignee);
  }
  const isFiltered = filters.toString() !== "";

  const listQuery = new URLSearchParams(filters);
  listQuery.set("limit", PAGE_SIZE);
  if (cursor) listQuery.set("cursor", cursor);

  /** A link to the list with the current filters, at a page. */
  const pageHref = (pageCursor?: string) => {
    const query = new URLSearchParams(filters);
    if (pageCursor) query.set("cursor", pageCursor);
    const qs = query.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  const { me, membership } = await getViewer();
  const [{ tickets, nextCursor }, summary] = await Promise.all([
    apiGet<TicketListResponse>(`/api/tickets?${listQuery}`),
    apiGet<TicketSummaryResponse>("/api/tickets/summary"),
  ]);
  const canCreate = viewerCan(me, "ticket.create");

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={
          membership.role === "agent"
            ? "Tickets you opened or that are assigned to you."
            : "Every ticket in your organization."
        }
        action={canCreate ? <NewTicketDialog /> : undefined}
      />

      <div className="space-y-8 px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Open"
            value={formatNumber(summary.open)}
            caption="Waiting on your team"
          />
          <MetricCard
            label="Pending"
            value={formatNumber(summary.pending)}
            caption="Waiting on the customer"
          />
          <MetricCard
            label="Resolved"
            value={formatNumber(summary.resolved)}
            caption="Solved, not yet closed"
          />
          <MetricCard
            label="Urgent"
            value={formatNumber(summary.urgent)}
            caption="Urgent and still active"
          />
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent tickets</h2>
            <TicketFilters assignees={assignees} />
          </div>
          {tickets.length === 0 && (isFiltered || cursor) ? (
            <div className="border-border rounded-sm border">
              <EmptyState
                icon={SearchX}
                title="No tickets match these filters"
                description="Try another status, priority or assignee, or clear the filters to see every ticket."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard">Clear filters</Link>
                  </Button>
                }
              />
            </div>
          ) : tickets.length === 0 ? (
            <div className="border-border rounded-sm border">
              <EmptyState
                icon={Inbox}
                title="No tickets yet"
                description={
                  canCreate
                    ? "File the first customer issue and AI triage will prioritize it for you."
                    : "Tickets filed by your organization's agents will appear here."
                }
                action={
                  canCreate ? <NewTicketDialog variant="outline" /> : undefined
                }
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
                      Assignee
                    </TableHead>
                    <TableHead className="text-foreground hidden font-semibold lg:table-cell">
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
                      <TableCell className="hidden max-w-48 truncate md:table-cell">
                        {t.assignee ? (
                          (t.assignee.name ?? t.assignee.email)
                        ) : (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden whitespace-nowrap lg:table-cell">
                        {formatDate(t.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {(cursor || nextCursor) && (
            <div className="flex justify-end gap-2">
              {cursor && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={pageHref()}>First page</Link>
                </Button>
              )}
              {nextCursor && (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(nextCursor)}>
                    Next page
                    <ChevronRight className="ml-1.5 size-4" strokeWidth={1.5} />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
