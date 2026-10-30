"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, UserPlus } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@upstart13-com/aiden-ui";
import { AddMemberBody } from "@/lib/validation/admin";

type AddMemberValues = z.infer<typeof AddMemberBody>;

const ROLES: Record<AddMemberValues["role"], string> = {
  agent: "Agent",
  viewer: "Viewer",
  owner: "Owner",
};

const DEFAULTS: AddMemberValues = { email: "", role: "agent" };

export function AddMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<AddMemberValues>({
    resolver: zodResolver(AddMemberBody),
    defaultValues: DEFAULTS,
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset(DEFAULTS);
    setOpen(next);
  }

  async function onSubmit(values: AddMemberValues) {
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body: { error?: unknown } | null = await res
        .json()
        .catch(() => null);
      form.setError("root", {
        message:
          typeof body?.error === "string"
            ? body.error
            : res.status === 403
              ? "Only owners can add members."
              : `Couldn't add the member (the server answered ${res.status}).`,
      });
      return;
    }

    toast.success("Member added", {
      description: `${values.email} joined as ${ROLES[values.role].toLowerCase()}.`,
    });
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1.5 size-4" strokeWidth={1.5} />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Add someone who already has a Deskline account. If they don&apos;t,
            ask them to register first.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="add-member-form" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-6 py-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="teammate@company.com"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="inline-grid">
                    <FormLabel>Role</FormLabel>
                    <DropdownMenu>
                      <FormControl>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
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
                          onValueChange={field.onChange}
                        >
                          {Object.entries(ROLES).map(([value, label]) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                              {label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p role="alert" className="text-destructive text-sm">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            form="add-member-form"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  strokeWidth={1.5}
                />
                Adding…
              </>
            ) : (
              "Add member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
