"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@upstart13-com/aiden-ui";
import { CreateTicketBody } from "@/lib/validation/ticket";

const NewTicketForm = CreateTicketBody.pick({ subject: true, body: true });
type NewTicketValues = z.infer<typeof NewTicketForm>;

export function NewTicketDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<NewTicketValues>({
    resolver: zodResolver(NewTicketForm),
    defaultValues: { subject: "", body: "" },
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    setOpen(next);
  }

  async function onSubmit(values: NewTicketValues) {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      toast.error("Couldn't create the ticket", {
        description:
          res.status === 403
            ? "Your role can't create tickets. Ask an agent to file it."
            : `The server answered ${res.status}. Try again in a moment.`,
      });
      return;
    }

    const { ticket }: { ticket: { id: string; triagedAt: string | null } } =
      await res.json();
    toast.success("Ticket created", {
      description: ticket.triagedAt
        ? "AI triage has set its priority and category."
        : "AI triage didn't run, so it keeps the default priority.",
    });
    handleOpenChange(false);
    router.push(`/dashboard/tickets/${ticket.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" strokeWidth={1.5} />
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>
            Describe the customer&apos;s issue. Priority, category and sentiment
            are set automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="new-ticket-form" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-6 py-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Card declined at checkout"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        placeholder="What happened, and what has the customer already tried?"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            form="new-ticket-form"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
