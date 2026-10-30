import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="bg-muted mb-4 rounded-sm p-3">
        <Icon className="text-muted-foreground size-6" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
