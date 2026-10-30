"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Copy, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { useAIStream } from "@upstart13-com/aiden-realtime/react";
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Skeleton,
} from "@upstart13-com/aiden-ui";
import { DraftBody } from "@/lib/validation/ticket";

type DraftRequest = z.output<typeof DraftBody>;

const TONES: Record<DraftRequest["tone"], string> = {
  neutral: "Neutral",
  apologetic: "Apologetic",
  concise: "Concise",
};

/** `useAIStream` reports HTTP failures as `stream_failed_<status>`. */
function describeError(error: Error): string {
  switch (error.message) {
    case "stream_failed_403":
      return "Your role can't generate AI drafts.";
    case "stream_failed_404":
      return "This ticket is no longer available to you.";
    case "stream_failed_429":
      return "Too many drafts in the last minute. Wait a moment and try again.";
    case "stream_failed_500":
      return "The AI provider didn't respond. Check that the API key is configured, then try again.";
    default:
      return `The draft stopped early (${error.message}). Try again.`;
  }
}

export function DraftPanel({ ticketId }: { ticketId: string }) {
  const form = useForm({
    resolver: zodResolver(DraftBody),
    defaultValues: { tone: "neutral" as const },
  });
  const { text, isLoading, error, send, reset } = useAIStream<DraftRequest>(
    `/api/tickets/${ticketId}/draft`,
  );
  const hasDraft = text.length > 0;

  async function copyDraft() {
    await navigator.clipboard.writeText(text);
    toast.success("Draft copied", {
      description: "Paste it into your reply to the customer.",
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(send)}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem className="inline-grid">
                  <DropdownMenu>
                    <FormControl>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                        >
                          Tone: {TONES[field.value ?? "neutral"]}
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
                        {Object.entries(TONES).map(([value, label]) => (
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

            <div className="flex gap-2">
              {hasDraft && !isLoading && (
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  <X className="mr-1.5 size-4" strokeWidth={1.5} />
                  Discard
                </Button>
              )}
              {hasDraft && !isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyDraft}
                >
                  <Copy className="mr-1.5 size-4" strokeWidth={1.5} />
                  Copy
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isLoading}>
                <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
                {isLoading
                  ? "Drafting…"
                  : hasDraft
                    ? "Regenerate"
                    : "Draft reply"}
              </Button>
            </div>
          </form>
        </Form>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {describeError(error)}
          </p>
        )}

        {isLoading && !hasDraft ? (
          <div className="space-y-2" aria-label="Drafting reply">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : hasDraft ? (
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            aria-live="polite"
          >
            {text}
          </p>
        ) : (
          !error && (
            <p className="text-muted-foreground text-sm">
              Pick a tone and generate a reply. The draft streams in as it is
              written; nothing is sent to the customer.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}
