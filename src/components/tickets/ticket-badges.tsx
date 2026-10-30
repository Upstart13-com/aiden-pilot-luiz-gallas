import { Badge } from "@upstart13-com/aiden-ui";

type Status = "open" | "pending" | "resolved" | "closed";
type Priority = "low" | "medium" | "high" | "urgent";

const STATUS: Record<
  Status,
  { label: string; variant: "info" | "warning" | "success" | "secondary" }
> = {
  open: { label: "Open", variant: "info" },
  pending: { label: "Pending", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "secondary" },
};

const PRIORITY: Record<
  Priority,
  { label: string; variant: "destructive" | "error" | "secondary" | "outline" }
> = {
  urgent: { label: "Urgent", variant: "destructive" },
  high: { label: "High", variant: "error" },
  medium: { label: "Medium", variant: "secondary" },
  low: { label: "Low", variant: "outline" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, variant } = STATUS[status];
  return (
    <Badge variant={variant} className="gap-1.5">
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, variant } = PRIORITY[priority];
  return <Badge variant={variant}>{label}</Badge>;
}
