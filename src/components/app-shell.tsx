import type { ReactNode } from "react";
import type { User } from "next-auth";
import { DashboardHeader, DashboardNav } from "@upstart13-com/aiden-ui";
import { brand } from "@/config/brand";
import { adminNavItems, primaryNavItems, settingsNavItem } from "@/config/nav";
import { aidenConfig } from "@/../aiden.config";

interface AppShellProps {
  user: User & { id: string };
  showAdmin: boolean;
  children: ReactNode;
}

/** Sidebar and mobile header shared by /dashboard and /admin. */
export function AppShell({ user, showAdmin, children }: AppShellProps) {
  const secondaryNavItems = showAdmin
    ? [...adminNavItems, settingsNavItem]
    : [settingsNavItem];

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <DashboardNav
        user={user}
        primaryNavItems={primaryNavItems}
        secondaryNavItems={secondaryNavItems}
        brand={brand}
        settingsHref={settingsNavItem.href}
        showBilling={aidenConfig.billing.enabled}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          user={user}
          primaryNavItems={primaryNavItems}
          secondaryNavItems={secondaryNavItems}
          brand={brand}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
