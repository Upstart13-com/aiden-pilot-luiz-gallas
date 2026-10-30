/** Matches what `withAuth` returns; `P` is the route's (promised) params. */
type Handler<P> = (req: Request, ctx?: { params: P }) => Promise<Response>;

type CallOptions<P> = {
  query?: Record<string, string>;
  body?: unknown;
  params?: Awaited<P>;
};

type CallResult = {
  status: number;
  // Route responses are asserted field by field, so the body stays loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
  res: Response;
};

/** Invoke a route handler the way Next does, and parse a JSON response. */
export async function call<P>(
  handler: Handler<P>,
  method: string,
  { query, body, params }: CallOptions<P> = {}
): Promise<CallResult> {
  const url = new URL("http://localhost/api");
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  const req = new Request(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Next passes params as a promise; P is that promise type.
  const res = await handler(req, { params: Promise.resolve(params ?? {}) as P });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  return { status: res.status, json: isJson ? await res.json() : null, res };
}
