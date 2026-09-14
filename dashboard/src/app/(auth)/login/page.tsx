import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "no-profile": "This account isn't linked to an agency.",
  disabled: "This login has been disabled. Ask your agency owner.",
  "not-platform": "That page is for GuardForce staff.",
};

function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden>
        <path d="M13 2 3.5 5.5v6.2c0 5.6 4 10.4 9.5 12.3 5.5-1.9 9.5-6.7 9.5-12.3V5.5L13 2Z" fill="currentColor" className="text-primary" />
        <path d="M8.5 13.2 11.6 16.3 17.6 9.9" stroke="var(--primary-foreground)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">GuardForce</span>
    </div>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="grain relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Logo className="relative z-10 [&_.text-primary]:text-sidebar-primary" />
        <div className="relative z-10 max-w-sm">
          <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-tight">
            Guard operations, on the record.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-foreground/65">
            Attendance, patrols and site coverage for security agencies, verified in the field and ready to share with clients.
          </p>
        </div>
        <div className="relative z-10 font-mono text-[11px] tracking-wide text-sidebar-foreground/40">
          Hosted in Mumbai · Encrypted at rest
        </div>
        <svg className="absolute -right-32 -bottom-32 size-[520px] text-sidebar-primary/15" viewBox="0 0 100 100" fill="none" aria-hidden>
          <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 2" />
          <circle cx="50" cy="50" r="36" stroke="currentColor" strokeWidth="0.4" />
          <circle cx="50" cy="50" r="24" stroke="currentColor" strokeWidth="0.4" strokeDasharray="3 2" />
          <circle cx="50" cy="50" r="2" fill="currentColor" />
        </svg>
      </div>

      {/* Form panel */}
      <div className="flex flex-col p-6 sm:p-10">
        <Logo className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[340px]">
            <h2 className="font-display text-[26px] font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Use the email your agency registered.</p>
            <div className="mt-8">
              <LoginForm next={next} initialError={error} />
            </div>
          </div>
        </div>
        <p className="text-center font-mono text-[11px] text-muted-foreground/70 lg:text-left">
          Guards sign in from the GuardForce Android app.
        </p>
      </div>
    </div>
  );
}
