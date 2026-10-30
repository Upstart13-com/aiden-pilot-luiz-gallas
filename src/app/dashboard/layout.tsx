import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { User } from "next-auth";
import { Building2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { auth } from "@/lib/auth";
import { abilities } from "@/lib/abilities";
import { findMembership } from "@/lib/membership";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const user = session.user as User & { id: string };
  const membership = await findMembership(user.id);
  const showAdmin = abilities.can(
    session as never,
    "org.members.manage",
    membership,
  );

  return (
    <AppShell user={user} showAdmin={showAdmin}>
      {membership ? (
        children
      ) : (
        <EmptyState
          icon={Building2}
          title="You're not part of an organization yet"
          description="Ask an owner of your organization to add you. Once you're a member, your tickets will show up here."
        />
      )}
    </AppShell>
  );
}
