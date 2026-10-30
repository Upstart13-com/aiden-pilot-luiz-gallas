"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@upstart13-com/aiden-ui";
import { UpdateTicketBody } from "@/lib/validation/ticket";
import { patchTicket } from "./patch-ticket";

type TicketUpdate = z.input<typeof UpdateTicketBody>;
type Status = "open" | "pending" | "resolved" | "closed";

/** Closing has its own confirmed button, so it isn't offered here. */
const STATUSES = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
} as const;
const LABELS: Record<Status, string> = { ...STATUSES, closed: "Closed" };

export function StatusMenu({
  ticketId,
  status,
}: {
  ticketId: string;
  status: Status;
}) {
  const router = useRouter();
  const form = useForm<TicketUpdate>({
    resolver: zodResolver(UpdateTicketBody),
    defaultValues: { status },
  });
  const saving = form.formState.isSubmitting;

  // After a successful save the page re-renders with the new status.
  useEffect(() => form.reset({ status }), [status, form]);

  const submit = form.handleSubmit(async (values) => {
    const result = await patchTicket(ticketId, values);
    if (!result.ok) {
      form.reset({ status });
      toast.error("Couldn't change the status", {
        description: result.message,
      });
      return;
    }
    toast.success("Status updated", {
      description: `The ticket is now ${LABELS[values.status ?? status].toLowerCase()}.`,
    });
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={submit}>
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="inline-grid">
              <DropdownMenu>
                <FormControl>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                    >
                      {saving && (
                        <Loader2
                          className="mr-1.5 size-4 animate-spin"
                          strokeWidth={1.5}
                        />
                      )}
                      {LABELS[field.value ?? status]}
                      <ChevronDown
                        className="ml-1.5 size-4"
                        strokeWidth={1.5}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                </FormControl>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={field.value}
                    onValueChange={(next) => {
                      if (next === field.value) return;
                      field.onChange(next);
                      void submit();
                    }}
                  >
                    {Object.entries(STATUSES).map(([value, label]) => (
                      <DropdownMenuRadioItem key={value} value={value}>
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
