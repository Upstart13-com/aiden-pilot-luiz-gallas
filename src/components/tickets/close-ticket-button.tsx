"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@upstart13-com/aiden-ui";

export function CloseTicketButton({
  ticketId,
  subject,
}: {
  ticketId: string;
  subject: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    setClosing(true);
    const res = await fetch(`/api/tickets/${ticketId}/close`, {
      method: "POST",
    });
    setClosing(false);

    if (!res.ok) {
      toast.error("Couldn't close the ticket", {
        description:
          res.status === 403
            ? "Your role can't close tickets."
            : `The server answered ${res.status}. Try again in a moment.`,
      });
      return;
    }

    toast.success("Ticket closed", {
      description: "It stays in the list, marked as closed.",
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Close ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Close ticket</DialogTitle>
          <DialogDescription>
            Close <strong>&ldquo;{subject}&rdquo;</strong>? It will be marked as
            closed for everyone in your organization.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={closing}>
            {closing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Closing…
              </>
            ) : (
              "Close ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
