import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Smartphone } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/data/settings";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { fmtAgo } from "@/lib/domain/format";
import { AppConfigForm } from "./app-config-form";

export const metadata: Metadata = { title: "App config · Settings" };
export const dynamic = "force-dynamic";

export default async function AppConfigPage() {
  const session = await requireSession();
  if (!session.isManager) notFound();
  const { config, devices, staleBefore } = await loadAppConfig(session);

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Guard app"
        description="Remote config the Android app reads on launch. Most changes ship this way rather than through the Play Store."
        style={{ ["--i" as string]: 1 }}
      >
        <AppConfigForm config={config} canEdit={session.isOwner} />
      </Section>

      <Section title={`Devices (${devices.length})`} description="What the fleet is actually running" bodyClassName="p-0" style={{ ["--i" as string]: 2 }}>
        {devices.length === 0 ? (
          <EmptyState icon={<Smartphone />} title="No devices yet" description="Devices appear here after a guard signs in to the app." className="border-0" />
        ) : (
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm" aria-label="Devices">
              <thead className="sticky top-0 bg-card">
                <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>Holder</th>
                  <th>Device</th>
                  <th>OS</th>
                  <th>App</th>
                  <th>Bundle</th>
                  <th className="text-right">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devices.map((d) => {
                  const stale = d.last_seen_at ? new Date(d.last_seen_at).getTime() < staleBefore : true;
                  return (
                    <tr key={d.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2">{d.holder_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{d.device_model ?? "—"}</td>
                      <td className="px-4 py-2"><Mono className="text-muted-foreground">{d.platform} {d.os_version ?? ""}</Mono></td>
                      <td className="px-4 py-2">
                        <Mono>{d.app_version ?? "—"}</Mono>
                        {d.app_version && config.min_app_version && compareVersions(d.app_version, config.min_app_version) < 0 && (
                          <StatusPill tone="signal" size="xs" className="ml-1.5">below minimum</StatusPill>
                        )}
                      </td>
                      <td className="px-4 py-2"><Mono className="text-muted-foreground">{d.bundle_version ?? "—"}</Mono></td>
                      <td className="px-4 py-2 text-right">
                        <Mono className={stale ? "text-muted-foreground" : ""}>{fmtAgo(d.last_seen_at)}</Mono>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
