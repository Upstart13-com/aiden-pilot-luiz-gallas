/**
 * AIDEN feature flags.
 *
 * `aiden doctor` reads this to decide which env vars are required, and
 * `aiden upgrade` reads it to know which codemods to apply.
 */

export const aidenConfig = {
  /** AIDEN single-train version this app was last upgraded to. */
  version: "2.0.1",

  /**
   * Your app's identity. These are placeholders — replace them with your
   * product's real values. `NEXT_PUBLIC_APP_*` env vars override the
   * name/tagline/copyright at runtime (see src/config/brand.ts).
   */
  app: {
    name: "Deskline",
    shortName: "deskline",
    tagline: "The AI-assisted support desk for your whole team.",
    description:
      "Deskline is a multi-tenant support desk where agents triage and answer customer tickets with AI-drafted replies.",
    supportEmail: "support@deskline.com",
    url: "",
    companyLegalName: "Deskline, Inc.",
    footerLinks: [],
  },

  auth: {
    providers: {
      google: false,
      github: false,
      microsoft: false,
      credentials: true,
    },
  },

  ai: {
    /** The active provider. Change this one line to swap vendors. */
    defaultProvider: "anthropic",

    /** Toggle providers. Install the matching SDK for each enabled one. */
    providers: {
      openai: false,
      anthropic: true,
      google: false,
      mistral: false,
      groq: false,
      cohere: false,
    },

    /** Default model per provider, read by src/lib/ai.ts. */
    models: {
      openai: "gpt-4o-mini",
      anthropic: "claude-haiku-4-5",
      google: "gemini-2.5-flash",
      mistral: "mistral-small-latest",
      groq: "llama-3.3-70b-versatile",
      cohere: "command-r",
    },
  },

  audit: {
    enabled: true, // Prisma sink registered in src/lib/audit.ts
  },

  rbac: {
    enabled: true, // roles seeded in prisma/seed.ts; rules in src/lib/abilities.ts
  },

  billing: {
    enabled: false, // toggle when wiring Stripe in src/lib/stripe.ts
  },

  email: {
    enabled: false, // toggle when wiring SendGrid in src/lib/email.ts
  },
} as const;

export type AidenConfig = typeof aidenConfig;
