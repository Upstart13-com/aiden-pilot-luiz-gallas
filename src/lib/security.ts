import "server-only";
import { configureSecurity } from "@upstart13-com/aiden-security";
import { auth } from "@/lib/auth";
// Registers the Prisma audit sink in the same module graph as the route
// handlers; registering it only from instrumentation.ts never reaches them.
import "@/lib/audit";

configureSecurity({ getSession: () => auth() });

export {
  withAuth,
  parseRequest,
  assertOwnership,
  assertCan,
  auditLog,
  RequestValidationError,
  OwnershipError,
  AbilityError,
} from "@upstart13-com/aiden-security";
