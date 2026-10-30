"use client";

import { useRouter } from "next/navigation";
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

export function EventFilter({
  events,
  current,
}: {
  events: readonly string[];
  current?: string;
}) {
  const router = useRouter();

  function select(value: string) {
    router.push(
      value === ALL
        ? "/admin/audit"
        : `/admin/audit?event=${encodeURIComponent(value)}`,
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Event: {current ?? "All events"}
          <ChevronDown className="ml-1.5 size-4" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={current ?? ALL} onValueChange={select}>
          <DropdownMenuRadioItem value={ALL}>All events</DropdownMenuRadioItem>
          {events.map((event) => (
            <DropdownMenuRadioItem key={event} value={event}>
              {event}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
