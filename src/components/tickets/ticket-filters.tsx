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

const FILTERS = {
  status: {
    label: "Status",
    options: {
      open: "Open",
      pending: "Pending",
      resolved: "Resolved",
      closed: "Closed",
    },
  },
  priority: {
    label: "Priority",
    options: { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" },
  },
} as const;

type FilterKey = keyof typeof FILTERS;
const FILTER_KEYS: readonly FilterKey[] = ["status", "priority"];

/** Status and priority filters for the ticket list. They live in the URL. */
export function TicketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

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
      {FILTER_KEYS.map((key) => {
        const { label, options } = FILTERS[key];
        const labels: Record<string, string> = options;
        const current = params.get(key);
        const currentLabel = (current && labels[current]) || "All";
        return (
          <DropdownMenu key={key}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {label}: {currentLabel}
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
