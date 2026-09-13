import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Left: the pitch, set like a ledger page */}
      <div className="grain relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="relative z-10 flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 26 26" fill="none" aria-hidden>
            <path d="M13 2 3.5 5.5v6.2c0 5.6 4 10.4 9.5 12.3 5.5-1.9 9.5-6.7 9.5-12.3V5.5L13 2Z" fill="var(--sidebar-primary)" />
            <path d="M8.5 13.2 11.6 16.3 17.6 9.9" stroke="var(--sidebar-primary-foreground)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-xl font-semibold tracking-tight">GuardForce</span>
        </div>
        <div className="relative z-10 max-w-md">
          <div className="eyebrow mb-4 text-sidebar-primary">Agency control room</div>
          <h1 className="font-display text-[44px] leading-[1.02] font-semibold tracking-tight">
            Every guard verified.<br />Every patrol proved.<br />Every record ready to share.
          </h1>
          <ol className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] text-sidebar-foreground/70">
            {[
              "Did they reach the site?",
              "Did they stay the full shift?",
              "Did patrolling happen?",
              "How long were they outside?",
              "Were they alert on duty?",
              "Is the record shareable?",
            ].map((q, i) => (
              <li key={q} className="flex gap-2">
                <span className="text-sidebar-primary">0{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative z-10 font-mono text-[11px] text-sidebar-foreground/45">
          Data residency: Mumbai · KYC vault encrypted at rest · access-logged
        </div>
        {/* decorative fence rings */}
        <svg className="absolute -right-40 -bottom-40 size-[560px] text-sidebar-primary/20" viewBox="0 0 100 100" fill="none" aria-hidden>
          <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 2" />
          <circle cx="50" cy="50" r="36" stroke="currentColor" strokeWidth="0.4" />
          <circle cx="50" cy="50" r="24" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 2" />
          <circle cx="50" cy="50" r="2" fill="currentColor" />
        </svg>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-2xl font-semibold tracking-tight">GuardForce</span>
          </div>
          <div className="eyebrow mb-2">Sign in</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Owners and supervisors sign in with email. Guards use the Android app.</p>
          <div className="mt-8">
            <LoginForm next={next} initialError={error === "no-profile" ? "This account isn't linked to an agency." : undefined} />
          </div>
          <p className="mt-10 font-mono text-[11px] text-muted-foreground">
            Demo: owner@sentinel.test / guardforce
          </p>
        </div>
      </div>
    </div>
  );
}
