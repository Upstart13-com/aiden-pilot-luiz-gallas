import Link from "next/link";
import { Button } from "@upstart13-com/aiden-ui/components/button";
import { Badge } from "@upstart13-com/aiden-ui/components/badge";
import {
  ArrowRight,
  Building2,
  Eye,
  Gauge,
  Headset,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCog,
} from "lucide-react";
import { brand } from "@/config/brand";

const features = [
  {
    icon: Tags,
    title: "AI triage",
    description:
      "Every new ticket gets a priority, a category and the customer's sentiment the moment it's filed.",
  },
  {
    icon: Sparkles,
    title: "Draft replies",
    description:
      "Agents generate a reply in the tone they choose and watch it stream in. Nothing reaches the customer until they send it.",
  },
  {
    icon: Building2,
    title: "One desk per organization",
    description:
      "Each organization's tickets, members and history stay inside it. Other organizations can't see that they exist.",
  },
  {
    icon: UserCog,
    title: "Three clear roles",
    description:
      "Owners run the organization, agents work tickets, viewers follow along. No permission matrix to maintain.",
  },
  {
    icon: ScrollText,
    title: "Audit trail",
    description:
      "Ticket changes, role changes and refused requests are recorded, so owners can see who did what and when.",
  },
  {
    icon: Gauge,
    title: "AI cost in view",
    description:
      "Owners see token usage and spend per feature and per model, so AI cost never arrives as a surprise.",
  },
];

const roles = [
  {
    icon: ShieldCheck,
    name: "Owner",
    summary: "Runs the organization",
    abilities: [
      "Reads every ticket in the organization",
      "Manages members and their roles",
      "Reviews the audit trail and AI spend",
    ],
  },
  {
    icon: Headset,
    name: "Agent",
    summary: "Works the tickets",
    abilities: [
      "Files, updates and closes their tickets",
      "Drafts replies with AI",
      "Sees tickets they opened or are assigned",
    ],
  },
  {
    icon: Eye,
    name: "Viewer",
    summary: "Follows along",
    abilities: [
      "Reads every ticket in the organization",
      "Can't change tickets or use AI",
      "Ideal for leads and stakeholders",
    ],
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="border-border relative overflow-hidden border-b">
        <div className="bg-dot-grid pointer-events-none absolute inset-0" />
        <div className="from-background/0 via-background/0 to-background pointer-events-none absolute inset-0 bg-gradient-to-b" />

        <div className="relative container flex flex-col items-center py-24 text-center md:py-40">
          <Badge
            variant="outline"
            className="text-muted-foreground mb-8 font-mono text-xs tracking-widest"
          >
            AI-ASSISTED SUPPORT DESK
          </Badge>

          <p className="text-accent mb-4 font-mono text-sm tracking-widest">
            {brand.name}
          </p>

          <h1 className="max-w-4xl text-5xl leading-none font-bold tracking-tight sm:text-6xl md:text-8xl">
            Every ticket,
            <br />
            <span className="text-accent">[triaged.]</span>
          </h1>

          <p className="text-muted-foreground mt-8 max-w-xl text-lg leading-relaxed">
            Deskline gives your support team one place to triage, answer and
            close customer tickets, with AI that sorts the queue and drafts the
            first reply.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="px-8">
              <Link href="/dashboard">
                Open your desk
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8">
              <Link href="/register">Create an account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="border-border border-b">
        <div className="container py-20 md:py-32">
          <div className="mb-12 max-w-xl space-y-3 md:mb-16">
            <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
              [01 — What it does]
            </p>
            <h2 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">
              Less sorting.
              <br />
              More answering.
            </h2>
          </div>

          <div className="border-border bg-border grid grid-cols-1 gap-px border sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group bg-background hover:bg-muted/30 space-y-5 p-8 transition-colors"
              >
                <div className="border-border group-hover:border-accent/40 flex size-9 items-center justify-center rounded-sm border transition-colors">
                  <Icon
                    className="text-muted-foreground group-hover:text-accent size-4 transition-colors"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────────────── */}
      <section className="border-border bg-muted/20 border-b">
        <div className="container py-20 md:py-32">
          <div className="mb-12 max-w-xl space-y-3 md:mb-16">
            <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
              [02 — Who does what]
            </p>
            <h2 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">
              Three roles.
              <br />
              <span className="text-accent">[No guesswork.]</span>
            </h2>
          </div>

          <div className="border-border grid grid-cols-1 border md:grid-cols-3">
            {roles.map(({ icon: Icon, name, summary, abilities }, i) => (
              <div
                key={name}
                className={`bg-background space-y-6 p-8 md:p-10 ${i < roles.length - 1 ? "border-border border-b md:border-r md:border-b-0" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="text-accent size-5" strokeWidth={1.5} />
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">
                      {name}
                    </h3>
                    <p className="text-muted-foreground font-mono text-xs tracking-wide">
                      {summary}
                    </p>
                  </div>
                </div>
                <ul className="border-border space-y-3 border-t pt-6">
                  {abilities.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <span className="bg-accent mt-1.5 size-1.5 shrink-0 rounded-full" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="bg-foreground text-background">
        <div className="container flex flex-col items-center py-20 text-center md:py-32">
          <p className="mb-6 font-mono text-xs tracking-widest uppercase opacity-50">
            [Get started]
          </p>
          <h2 className="max-w-3xl text-4xl leading-tight font-bold tracking-tight md:text-6xl">
            Bring your team.
            <br />
            Clear the queue.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed opacity-60">
            Create an account, ask your organization&apos;s owner to add you,
            and start working tickets.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-background text-foreground hover:bg-background/90 px-8"
            >
              <Link href="/register">
                Create an account
                <ArrowRight className="size-4" strokeWidth={1.5} />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="hover:bg-background/10 text-background px-8 opacity-60 hover:opacity-100"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
