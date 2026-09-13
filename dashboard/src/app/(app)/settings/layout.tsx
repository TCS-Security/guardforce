import { PageHeader } from "@/components/gf/page-header";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <PageHeader eyebrow="Agency" title="Settings" description="Agency defaults, team access, notifications, guard-app config and the audit trail." />
      <SettingsNav />
      {children}
    </div>
  );
}
