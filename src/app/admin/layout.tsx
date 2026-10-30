import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { User } from "next-auth";
import { ShieldAlert } from "lucide-react";
import { Button } from "@upstart13-com/aiden-ui";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { auth } from "@/lib/auth";
import { getMe, viewerCan } from "@/lib/page-context";

/**
 * Guard for everything under `/admin`: owners only. Other members see an
 * explanation instead of a redirect, so they know why the page is closed.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/members");

  const user = session.user as User & { id: string };
  const me = await getMe();
  const isOwner = viewerCan(me, "org.members.manage");

  return (
    <AppShell user={user} showAdmin={isOwner}>
      {isOwner ? (
        children
      ) : (
        <EmptyState
          icon={ShieldAlert}
          title="Owners only"
          description="Members, audit and cost pages are available to your organization's owners. Ask an owner if you need access."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Back to tickets</Link>
            </Button>
          }
        />
      )}
    </AppShell>
  );
}
