"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@upstart13-com/aiden-ui";

const ALL = "all";

type FilterKey = "status" | "priority" | "assignee";
type Filter = {
  key: FilterKey;
  label: string;
  options: Record<string, string>;
};

const STATUS_OPTIONS = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};
const PRIORITY_OPTIONS = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Status, priority and assignee filters for the ticket list. They live in
 * the URL. `assignees` maps a member's user id to their display name.
 */
export function TicketFilters({
  assignees,
}: {
  assignees: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: readonly Filter[] = [
    { key: "status", label: "Status", options: STATUS_OPTIONS },
    { key: "priority", label: "Priority", options: PRIORITY_OPTIONS },
    {
      key: "assignee",
      label: "Assignee",
      options: { unassigned: "Unassigned", ...assignees },
    },
  ];

  function select(key: FilterKey, value: string) {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    // A new filter starts again from the first page.
    next.delete("cursor");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ key, label, options }) => {
        const current = params.get(key);
        const currentLabel = (current && options[current]) || "All";
        return (
          <DropdownMenu key={key}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <span className="max-w-40 truncate">
                  {label}: {currentLabel}
                </span>
                <ChevronDown className="ml-1.5 size-4" strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={current ?? ALL}
                onValueChange={(value) => select(key, value)}
              >
                <DropdownMenuRadioItem value={ALL}>All</DropdownMenuRadioItem>
                {Object.entries(options).map(([value, text]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {text}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
