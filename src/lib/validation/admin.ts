import { z } from "zod";

export const RoleChangeBody = z.object({
  role: z.enum(["owner", "agent", "viewer"]),
});

export const AuditQuery = z.object({
  event: z.string().min(1).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
