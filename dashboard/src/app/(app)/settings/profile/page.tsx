import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { Section } from "@/components/gf/section";
import { KvList } from "@/components/gf/kv";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { fmtDate } from "@/lib/domain/format";
import { ProfileForms } from "./profile-forms";

export const metadata: Metadata = { title: "My profile · Settings" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await requireSession();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <ProfileForms fullName={session.profile.full_name} phone={session.profile.phone} />
      <Section title="Account" style={{ ["--i" as string]: 3 }}>
        <div className="mb-4 flex items-center gap-3">
          <GuardAvatar name={session.profile.full_name} size="lg" />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-semibold">{session.profile.full_name}</div>
            <div className="truncate text-xs text-muted-foreground">{session.profile.email}</div>
          </div>
        </div>
        <KvList
          items={[
            { k: "Role", v: <span className="capitalize">{session.profile.role}</span> },
            { k: "Agency", v: session.agency.name },
            { k: "Sites", v: session.isOwner || session.profile.all_sites ? "All sites" : `${session.siteIds.length} scoped` },
            { k: "Member since", v: fmtDate(session.profile.created_at, session.agency.timezone) },
          ]}
        />
      </Section>
    </div>
  );
}
