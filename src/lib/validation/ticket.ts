import { z } from "zod";

export const RouteParams = z.object({
  id: z.string().min(1),
});

export const ListTicketsQuery = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
