import { Card } from "@upstart13-com/aiden-ui";

interface MetricCardProps {
  label: string;
  value: string;
  caption: string;
}

export function MetricCard({ label, value, caption }: MetricCardProps) {
  return (
    <Card className="p-5 shadow-none">
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{caption}</p>
    </Card>
  );
}
