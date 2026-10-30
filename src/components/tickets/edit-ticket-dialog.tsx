"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
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
import { patchTicket } from "./patch-ticket";

const EditTicketForm = CreateTicketBody.pick({ subject: true, body: true });
type EditTicketValues = z.infer<typeof EditTicketForm>;

export function EditTicketDialog({
  ticketId,
  subject,
  body,
}: {
  ticketId: string;
  subject: string;
  body: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<EditTicketValues>({
    resolver: zodResolver(EditTicketForm),
    defaultValues: { subject, body },
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset({ subject, body });
    setOpen(next);
  }

  async function onSubmit(values: EditTicketValues) {
    const result = await patchTicket(ticketId, values);
    if (!result.ok) {
      toast.error("Couldn't save the ticket", { description: result.message });
      return;
    }
    toast.success("Ticket updated", {
      description: result.ticket.triagedAt
        ? "AI triage re-checked its priority and category."
        : "AI triage didn't run, so its priority is unchanged.",
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1.5 size-4" strokeWidth={1.5} />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit ticket</DialogTitle>
          <DialogDescription>
            Changing the subject or description runs AI triage again.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="edit-ticket-form" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-6 py-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Textarea rows={6} {...field} />
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
            form="edit-ticket-form"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  strokeWidth={1.5}
                />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
