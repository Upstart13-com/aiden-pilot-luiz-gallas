import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@upstart13-com/aiden-ui";
import { CloseTicketButton } from "@/components/tickets/close-ticket-button";
import { DraftPanel } from "@/components/tickets/draft-panel";
import { PriorityBadge, StatusBadge } from "@/components/tickets/ticket-badges";
import { apiGet } from "@/lib/api-client";
import type { TicketDetailResponse } from "@/lib/api-types";
import { formatDate, formatDateTime } from "@/lib/format";
import { getViewer, viewerCan } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { me } = await getViewer();
  // 404s (missing, another org's, another agent's) become notFound().
  const { ticket } = await apiGet<TicketDetailResponse>(
    `/api/tickets/${encodeURIComponent(id)}`,
  );

  const canClose = ticket.status !== "closed" && viewerCan(me, "ticket.close");
  const canDraft = viewerCan(me, "ai.invoke");
  const person = (u: { name: string | null; email: string } | null) =>
    u ? (u.name ?? u.email) : "Unassigned";

  const details = [
    { label: "Status", value: <StatusBadge status={ticket.status} /> },
    { label: "Priority", value: <PriorityBadge priority={ticket.priority} /> },
    {
      label: "Category",
      value: ticket.triagedAt
        ? (ticket.category ?? "Uncategorized")
        : "Not triaged",
    },
    {
      label: "Sentiment",
      value: ticket.sentiment
        ? ticket.sentiment[0].toUpperCase() + ticket.sentiment.slice(1)
        : "Not triaged",
    },
    { label: "Assignee", value: person(ticket.assignee) },
  ];

  const activity = [
    { label: "Opened", at: ticket.createdAt },
    { label: "Triaged by AI", at: ticket.triagedAt },
    { label: "Closed", at: ticket.closedAt },
    { label: "Last updated", at: ticket.updatedAt },
  ].filter((e): e is { label: string; at: string } => e.at !== null);

  return (
    <div>
      <div className="border-border border-b px-6 py-5">
        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Tickets</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-48 truncate sm:max-w-md">
                {ticket.subject}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight break-words">
              {ticket.subject}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Opened by {person(ticket.owner)} · {formatDate(ticket.createdAt)}
            </p>
          </div>
          {canClose && (
            <CloseTicketButton ticketId={ticket.id} subject={ticket.subject} />
          )}
        </div>
      </div>

      <div className="px-6 pt-6 pb-8">
        <Tabs defaultValue="conversation">
          <TabsList>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            {canDraft && <TabsTrigger value="draft">AI draft</TabsTrigger>}
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
                    Customer message
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {ticket.body}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <dl className="space-y-4">
                    {details.map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4"
                      >
                        <dt className="text-muted-foreground shrink-0 text-sm">
                          {label}
                        </dt>
                        <dd className="text-foreground text-right text-sm font-medium">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {canDraft && (
            <TabsContent value="draft" className="mt-6">
              <DraftPanel ticketId={ticket.id} />
            </TabsContent>
          )}

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardContent>
                <ol className="space-y-4">
                  {activity.map(({ label, at }) => (
                    <li
                      key={label}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="font-medium">{label}</span>
                      <time className="text-muted-foreground" dateTime={at}>
                        {formatDateTime(at)}
                      </time>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
