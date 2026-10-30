// Test stand-in for the `server-only` package, wired up in vitest.config.mts.
// Outside a Next build the real package can't be used: it only ships inside
// next/dist/compiled, and its default entry throws because Vitest has no
// server/client split. Next still enforces it in dev and production builds.
export {};
