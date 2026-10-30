"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
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
import { RoleChangeBody } from "@/lib/validation/admin";

type RoleChange = z.infer<typeof RoleChangeBody>;
type Role = RoleChange["role"];

const ROLES: Record<Role, string> = {
  owner: "Owner",
  agent: "Agent",
  viewer: "Viewer",
};

/** Lowest to highest access. */
const ACCESS_ORDER: readonly string[] = ["viewer", "agent", "owner"];

export function RoleMenu({
  memberId,
  memberName,
  role,
}: {
  memberId: string;
  memberName: string;
  role: Role;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<RoleChange>({
    resolver: zodResolver(RoleChangeBody),
    defaultValues: { role },
  });
  const selected = useWatch({ control: form.control, name: "role" });
  const saving = form.formState.isSubmitting;

  // After a successful save the page re-renders with the new role.
  useEffect(() => form.reset({ role }), [role, form]);

  const submit = form.handleSubmit(async ({ role: next }) => {
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    setConfirming(false);

    if (!res.ok) {
      const body: { error?: unknown } | null = await res
        .json()
        .catch(() => null);
      form.reset({ role });
      form.setError("root", {
        message:
          typeof body?.error === "string"
            ? body.error
            : `Couldn't change the role (the server answered ${res.status}).`,
      });
      return;
    }

    toast.success("Role updated", {
      description: `${memberName} is now ${ROLES[next].toLowerCase()}.`,
    });
    router.refresh();
  });

  function afterSelect(next: string) {
    if (next === role) return;
    // Demotions remove access, so they are confirmed first.
    if (ACCESS_ORDER.indexOf(next) < ACCESS_ORDER.indexOf(role)) {
      setConfirming(true);
    } else {
      void submit();
    }
  }

  function cancel() {
    setConfirming(false);
    form.reset({ role });
  }

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-1">
        <FormField
          control={form.control}
          name="role"
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
                      {ROLES[field.value]}
                      <ChevronDown
                        className="ml-1.5 size-4"
                        strokeWidth={1.5}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                </FormControl>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup
                    value={field.value}
                    onValueChange={(next) => {
                      field.onChange(next);
                      afterSelect(next);
                    }}
                  >
                    {Object.entries(ROLES).map(([value, label]) => (
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

        {form.formState.errors.root && (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.root.message}
          </p>
        )}

        <Dialog open={confirming} onOpenChange={(open) => !open && cancel()}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Change role</DialogTitle>
              <DialogDescription>
                Make <strong>{memberName}</strong>{" "}
                {ROLES[selected].toLowerCase()}? They will lose access that
                comes with the {ROLES[role].toLowerCase()} role.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button type="button" onClick={() => submit()} disabled={saving}>
                {saving ? "Saving…" : "Change role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </Form>
  );
}
