import { NextResponse } from "next/server";
import { withAuth } from "@/lib/security";
import { auditReader } from "@/lib/audit";

/** The caller's own recent sign-ins, for the security settings page. */
export const GET = withAuth(async (_req, { session }) => {
  const { entries } = await auditReader.list({
    userId: session.user.id,
    event: "auth.signin",
    limit: 10,
  });

  return NextResponse.json({
    signins: entries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
    })),
  });
});
