import type { DashboardNavItem } from "@upstart13-com/aiden-ui";

/**
 * Source of truth for the sidebar navigation. The layouts decide at render
 * time whether the caller sees the admin items (owners only).
 *
 * Icon names are resolved against `defaultNavIconRegistry` from
 * `@upstart13-com/aiden-ui`.
 */

export const primaryNavItems: DashboardNavItem[] = [
  { href: "/dashboard", label: "Tickets", icon: "Inbox", exact: true },
];

export const adminNavItems: DashboardNavItem[] = [
  { href: "/admin/members", label: "Members", icon: "Users", exact: false },
  { href: "/admin/audit", label: "Audit", icon: "Activity", exact: false },
  { href: "/admin/cost", label: "Cost", icon: "Receipt", exact: false },
];

export const settingsNavItem: DashboardNavItem = {
  href: "/dashboard/settings",
  label: "Settings",
  icon: "Settings",
  exact: false,
};
