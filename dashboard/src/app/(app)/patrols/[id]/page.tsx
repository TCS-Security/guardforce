import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, ImageOff } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadPatrol } from "@/lib/data/patrols";
import { patrolPhotoUrls } from "../actions";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { KvList } from "@/components/gf/kv";
import { Mono } from "@/components/gf/mono";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { PatrolStatusBadge } from "@/components/gf/attendance-badge";
import { PatrolMap } from "@/components/patrols/patrol-map";
import { PatrolNote } from "@/components/patrols/patrol-note";
import { latenessMin } from "@/lib/domain/patrols";
import { fmtDate, fmtDistance, fmtMinutes, fmtTime } from "@/lib/domain/format";
import type { FenceSite } from "@/lib/domain/geo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/patrols/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const data = await loadPatrol(session, id);
  const route = (data?.patrol.patrol_routes as { name?: string } | null)?.name;
  return { title: route ? `${route} · Patrol` : "Patrol" };
}

export default async function PatrolPage({ params }: PageProps<"/patrols/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  const data = await loadPatrol(session, id);
  if (!data) notFound();

  const { patrol, photos } = data;
  const guard = patrol.guards as unknown as { id: string; full_name: string; employee_code: string | null } | null;
  const site = patrol.sites as unknown as { id: string; name: string; lat: number; lng: number; fence_type: string; radius_m: number; polygon: unknown; leeway_m: number; patrol_photo_required: boolean } | null;
  const route = patrol.patrol_routes as unknown as { name: string; description: string | null; frequency_min: number; grace_min: number; min_photos: number } | null;
  if (!site) notFound();

  const tz = session.agency.timezone;
  const urls = await patrolPhotoUrls(photos.map((p) => p.file_path));
  const late = latenessMin(patrol.expected_at, patrol.started_at);
  const fenceSite: FenceSite = {
    lat: site.lat,
    lng: site.lng,
    fence_type: site.fence_type as "radius" | "polygon",
    radius_m: site.radius_m,
    polygon: site.polygon,
    leeway_m: site.leeway_m,
  };

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/patrols" className="hover:text-foreground">Patrols</Link> · {fmtDate(patrol.expected_at ?? patrol.started_at, tz)}
          </>
        }
        title={route?.name ?? "Patrol round"}
        description={
          <>
            <Link href={`/sites/${site.id}`} className="underline-offset-2 hover:underline">{site.name}</Link>
            {route?.description ? ` · ${route.description}` : ""}
          </>
        }
        actions={<PatrolStatusBadge status={patrol.status as never} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Expected"
          value={fmtTime(patrol.expected_at, tz)}
          hint={late > 0 ? `Started ${late} min late` : patrol.started_at ? "Started on time" : "Not started"}
          tone={late > (route?.grace_min ?? 15) ? "half-day" : "neutral"}
          style={{ ["--i" as string]: 1 }}
        />
        <StatTile label="Duration" value={patrol.duration_s ? fmtMinutes(patrol.duration_s / 60) : "—"} hint={patrol.ended_at ? `Ended ${fmtTime(patrol.ended_at, tz)}` : "Not finished"} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Distance" value={patrol.distance_m ? fmtDistance(patrol.distance_m) : "—"} hint="Walked along the recorded trail" style={{ ["--i" as string]: 3 }} />
        <StatTile
          label="Photo proof"
          value={`${photos.length}/${route?.min_photos ?? 0}`}
          tone={site.patrol_photo_required && photos.length < (route?.min_photos ?? 0) ? "half-day" : "neutral"}
          hint={site.patrol_photo_required ? "Required at this site" : "Optional at this site"}
          style={{ ["--i" as string]: 4 }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Route walked" bodyClassName="p-0" style={{ ["--i" as string]: 5 }}>
          <PatrolMap
            site={fenceSite}
            trail={patrol.trail}
            photos={photos.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, taken_at: p.taken_at, index: i + 1 }))}
            className="h-[360px] w-full overflow-hidden rounded-b-lg"
          />
        </Section>

        <div className="flex flex-col gap-4">
          <Section title="Round details" style={{ ["--i" as string]: 6 }}>
            <div className="mb-3 flex items-center gap-2.5">
              <GuardAvatar name={guard?.full_name ?? "Guard"} />
              <div className="min-w-0">
                <Link href={`/guards/${guard?.id}`} className="text-sm font-medium hover:underline">{guard?.full_name}</Link>
                <Mono className="block text-[11px] text-muted-foreground">{guard?.employee_code}</Mono>
              </div>
            </div>
            <KvList
              items={[
                { k: "Expected", v: <Mono>{fmtTime(patrol.expected_at, tz)}</Mono> },
                { k: "Started", v: <Mono>{fmtTime(patrol.started_at, tz)}</Mono> },
                { k: "Ended", v: <Mono>{fmtTime(patrol.ended_at, tz)}</Mono> },
                { k: "Frequency", v: route ? `every ${fmtMinutes(route.frequency_min)}` : "—" },
                { k: "Grace", v: route ? `${route.grace_min} min` : "—" },
                { k: "Shift", v: patrol.shift_id ? <Link href={`/attendance/${patrol.shift_id}`} className="text-primary hover:underline">Open the shift</Link> : "—" },
              ]}
            />
          </Section>

          <Section title="Supervisor note" style={{ ["--i" as string]: 7 }}>
            <PatrolNote patrolId={patrol.id} note={patrol.notes} canEdit={session.isManager} />
          </Section>
        </div>
      </div>

      <Section title={`Photo proof (${photos.length})`} bodyClassName="p-4" style={{ ["--i" as string]: 8 }}>
        {photos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {site.patrol_photo_required ? "No photos were captured on this round." : "This site does not require photo proof."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p, i) => {
              const url = urls[p.file_path];
              return (
                <li key={p.id} className="overflow-hidden rounded-lg border">
                  <div className="flex aspect-square items-center justify-center bg-muted">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`Patrol photo ${i + 1}`} className="size-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <ImageOff className="size-4" />
                        <span className="text-[10px]">not available</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <Camera className="size-3 text-muted-foreground" />
                    <Mono className="text-[11px] text-muted-foreground">{fmtTime(p.taken_at, tz)}</Mono>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
