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
type Assignee = { userId: string; name: string | null; email: string };

/** Radio items need a string value; this one stands for "no assignee". */
const UNASSIGNED = "unassigned";

export function AssigneeMenu({
  ticketId,
  assigneeId,
  ownerId,
  currentUserId,
  agents,
}: {
  ticketId: string;
  assigneeId: string | null;
  ownerId: string;
  currentUserId: string;
  /** Who can be assigned: the org's agents. */
  agents: Assignee[];
}) {
  const router = useRouter();
  const form = useForm<TicketUpdate>({
    resolver: zodResolver(UpdateTicketBody),
    defaultValues: { assigneeId },
  });
  const saving = form.formState.isSubmitting;
  const label = (id: string | null | undefined) => {
    const agent = agents.find((a) => a.userId === id);
    return agent ? (agent.name ?? agent.email) : "Unassigned";
  };

  useEffect(() => form.reset({ assigneeId }), [assigneeId, form]);

  const submit = form.handleSubmit(async (values) => {
    const result = await patchTicket(ticketId, values);
    if (!result.ok) {
      form.reset({ assigneeId });
      toast.error("Couldn't change the assignee", {
        description: result.message,
      });
      return;
    }

    // Agents only see tickets they own or are assigned. Handing off a
    // ticket you don't own means you can no longer open it.
    const stillVisible =
      ownerId === currentUserId || values.assigneeId === currentUserId;
    if (!stillVisible) {
      toast.success("Ticket reassigned", {
        description: `${label(values.assigneeId)} now has it, so it's no longer in your list.`,
      });
      router.push("/dashboard");
      return;
    }
    toast.success("Assignee updated", {
      description: values.assigneeId
        ? `Assigned to ${label(values.assigneeId)}.`
        : "The ticket is now unassigned.",
    });
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={submit}>
        <FormField
          control={form.control}
          name="assigneeId"
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
                      {label(field.value)}
                      <ChevronDown
                        className="ml-1.5 size-4"
                        strokeWidth={1.5}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                </FormControl>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={field.value ?? UNASSIGNED}
                    onValueChange={(next) => {
                      const value = next === UNASSIGNED ? null : next;
                      if (value === (field.value ?? null)) return;
                      field.onChange(value);
                      void submit();
                    }}
                  >
                    <DropdownMenuRadioItem value={UNASSIGNED}>
                      Unassigned
                    </DropdownMenuRadioItem>
                    {agents.map((a) => (
                      <DropdownMenuRadioItem key={a.userId} value={a.userId}>
                        {a.name ?? a.email}
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
