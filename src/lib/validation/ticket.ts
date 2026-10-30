import { z } from "zod";

export const RouteParams = z.object({
  id: z.string().min(1),
});

export const ListTicketsQuery = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  /** A member's user id, or "unassigned". */
  assignee: z.string().min(1).max(64).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const CreateTicketBody = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Add a short subject.")
    .max(200, "Keep the subject under 200 characters."),
  body: z
    .string()
    .trim()
    .min(1, "Describe the customer's issue.")
    .max(10_000, "Keep the description under 10,000 characters."),
  assigneeId: z.cuid().optional(),
});

export const UpdateTicketBody = z
  .object({
    subject: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(10_000).optional(),
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    assigneeId: z.cuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

export const DraftBody = z.object({
  tone: z.enum(["neutral", "apologetic", "concise"]).default("neutral"),
});
