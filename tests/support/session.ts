import type { RawSession } from "@upstart13-com/aiden-security";

let current: RawSession | null = null;

/** The session the mocked `auth()` returns. `null` means signed out. */
export function signInAs(user: { id: string; email: string } | null): void {
  current = user ? { user: { ...user, roles: [] } } : null;
}

export function currentSession(): RawSession | null {
  return current;
}
