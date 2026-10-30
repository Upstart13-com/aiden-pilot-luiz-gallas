import { Receipt } from "lucide-react";
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
import { apiGet } from "@/lib/api-client";
import type { UsageResponse } from "@/lib/api-types";
import { formatDateTime, formatNumber, formatUSD } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEATURE_LABELS: Record<string, string> = {
  "ticket.triage": "Triage",
  "ticket.draft": "Draft reply",
};
const featureLabel = (f: string | null) =>
  f ? (FEATURE_LABELS[f] ?? f) : "Other";

type Breakdown = {
  key: string;
  costUSD: number;
  totalTokens: number;
  calls: number;
};

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="border-border rounded-sm border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="text-foreground font-semibold">
                Name
              </TableHead>
              <TableHead className="text-foreground text-right font-semibold">
                Calls
              </TableHead>
              <TableHead className="text-foreground hidden text-right font-semibold sm:table-cell">
                Tokens
              </TableHead>
              <TableHead className="text-foreground text-right font-semibold">
                Spend
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="hover:bg-muted/50">
                <TableCell className="font-medium">{r.key}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.calls)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatNumber(r.totalTokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUSD(r.costUSD)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export default async function CostPage() {
  const usage = await apiGet<UsageResponse>("/api/admin/usage");
  const { allTime, last30Days } = usage.totals;

  return (
    <div>
      <PageHeader
        title="AI cost"
        subtitle="Token usage and spend for AI triage and draft replies in your organization."
      />
      <div className="space-y-8 px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total spend"
            value={formatUSD(allTime.costUSD)}
            caption="Since the first AI call"
          />
          <MetricCard
            label="Last 30 days"
            value={formatUSD(last30Days.costUSD)}
            caption={`${formatNumber(last30Days.calls)} calls`}
          />
          <MetricCard
            label="Tokens"
            value={formatNumber(allTime.totalTokens)}
            caption="Prompt and completion"
          />
          <MetricCard
            label="AI calls"
            value={formatNumber(allTime.calls)}
            caption="Triage and drafts"
          />
        </div>

        {allTime.calls === 0 ? (
          <div className="border-border rounded-sm border">
            <EmptyState
              icon={Receipt}
              title="No AI usage yet"
              description="Spend appears here once agents create tickets (triage) or generate draft replies."
            />
          </div>
        ) : (
          <>
            <BreakdownTable
              title="By member"
              rows={usage.byUser.map((u) => ({
                key: u.email ?? "Unknown member",
                ...u,
              }))}
            />

            <div className="grid gap-8 lg:grid-cols-2">
              <BreakdownTable
                title="By feature"
                rows={usage.byFeature.map((f) => ({
                  key: featureLabel(f.feature),
                  ...f,
                }))}
              />
              <BreakdownTable
                title="By model"
                rows={usage.byModel.map((m) => ({ key: m.model, ...m }))}
              />
            </div>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Recent calls</h2>
              <div className="border-border rounded-sm border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="text-foreground font-semibold">
                        When
                      </TableHead>
                      <TableHead className="text-foreground font-semibold">
                        Feature
                      </TableHead>
                      <TableHead className="text-foreground hidden font-semibold md:table-cell">
                        Model
                      </TableHead>
                      <TableHead className="text-foreground hidden text-right font-semibold sm:table-cell">
                        Tokens
                      </TableHead>
                      <TableHead className="text-foreground text-right font-semibold">
                        Cost
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.recent.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(r.createdAt)}
                        </TableCell>
                        <TableCell>{featureLabel(r.feature)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {r.model}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {formatNumber(r.totalTokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUSD(r.costUSD)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
