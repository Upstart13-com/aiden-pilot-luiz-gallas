import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

/**
 * Server-rendered pages read data only through the app's own API routes, so
 * every read crosses the same perimeter (withAuth, membership, assertCan,
 * scoped queries) as a request from the browser. Pages never touch Prisma.
 *
 * The origin is fixed, never taken from the request's Host header: the
 * caller's session cookie is forwarded, so the target must be this server.
 */
const API_ORIGIN =
  process.env.INTERNAL_API_URL ??
  `http://localhost:${process.env.PORT ?? 3000}`;

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, API_ORIGIN), {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });

  if (res.status === 401) redirect("/login");
  // Denials are 404s throughout, so a page never reveals that a row exists.
  if (res.status === 403 || res.status === 404) notFound();
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);

  return res.json();
}
