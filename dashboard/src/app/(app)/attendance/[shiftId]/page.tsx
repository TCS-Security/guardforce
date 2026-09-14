import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BatteryLow, Crosshair, ImageOff, MapPin, Smartphone } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadShift } from "@/lib/data/attendance";
import { selfieUrl } from "../actions";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { StatTile } from "@/components/gf/stat-tile";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { KvList } from "@/components/gf/kv";
import { AttendanceBadge, ShiftStatusBadge, TrustBadge } from "@/components/gf/attendance-badge";
import { ShiftMap } from "@/components/attendance/shift-map";
import { LogExceptionButton, OverrideAttendanceButton } from "./shift-actions";
import { awayIntervals, longestAway, totalAwaySeconds, trackingGaps } from "@/lib/domain/away";
import { EVENT_META, FLAG_LABELS, SEVERITY_TONE } from "@/lib/domain/status";
import { fmtDate, fmtDistance, fmtMinutes, fmtSeconds, fmtTime } from "@/lib/domain/format";
import type { FenceSite } from "@/lib/domain/geo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/attendance/[shiftId]">): Promise<Metadata> {
  const session = await requireSession();
  const { shiftId } = await params;
  const data = await loadShift(session, shiftId);
  const name = (data?.shift.guards as { full_name?: string } | null)?.full_name;
  return { title: name ? `${name} · Shift` : "Shift" };
}

export default async function ShiftPage({ params }: PageProps<"/attendance/[shiftId]">) {
  const session = await requireSession();
  requirePermission(session, "attendance:read");
  const { shiftId } = await params;
  const data = await loadShift(session, shiftId);
  if (!data) notFound();

  const { shift, pings, events, exception, audit } = data;
  const guard = shift.guards as unknown as { id: string; full_name: string; employee_code: string | null; designation: string | null; phone: string } | null;
  const site = shift.sites as unknown as { id: string; name: string; lat: number; lng: number; fence_type: string; radius_m: number; polygon: unknown; leeway_m: number } | null;
  const shiftType = shift.shift_types as unknown as { name: string } | null;
  if (!site) notFound();

  const tz = session.agency.timezone;
  const [startSelfie, endSelfie] = await Promise.all([selfieUrl(shift.start_selfie_path), selfieUrl(shift.end_selfie_path)]);

  const intervals = awayIntervals(pings, shift.end_captured_at ?? shift.ended_at ?? undefined);
  const worst = longestAway(intervals);
  const awaySeconds = intervals.length > 0 ? totalAwaySeconds(intervals) : shift.away_seconds;
  const gaps = trackingGaps(pings, session.agency.outage_threshold_min);
  const device = (shift.device ?? {}) as { battery_pct?: number; model?: string; app_version?: string; is_mock?: boolean };
  const fenceSite: FenceSite = {
    lat: site.lat,
    lng: site.lng,
    fence_type: site.fence_type as "radius" | "polygon",
    radius_m: site.radius_m,
    polygon: site.polygon,
    leeway_m: site.leeway_m,
  };
  const isVoid = shift.status === "void_location_off";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/attendance" className="hover:text-foreground">Attendance</Link> · {fmtDate(shift.shift_date, tz)} · {shiftType?.name ?? "Ad hoc"}
          </>
        }
        title={
          <span className="flex items-center gap-3">
            <GuardAvatar name={guard?.full_name ?? "Guard"} size="lg" />
            <Link href={`/guards/${guard?.id}`} className="hover:underline">{guard?.full_name ?? "Guard"}</Link>
          </span>
        }
        description={
          <>
            <Link href={`/sites/${site.id}`} className="underline-offset-2 hover:underline">{site.name}</Link>
            {" · "}{guard?.employee_code}{guard?.designation ? ` · ${guard.designation}` : ""}
          </>
        }
        actions={
          session.can("attendance:correct") ? (
            <div className="flex items-center gap-2">
              {isVoid && !shift.exception_id && <LogExceptionButton shiftId={shift.id} />}
              <OverrideAttendanceButton shiftId={shift.id} current={shift.attendance} />
            </div>
          ) : null
        }
      />

      {isVoid && (
        <div className="reveal flex flex-wrap items-center gap-3 rounded-lg border border-absent/30 bg-absent/8 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-absent" />
          <p className="min-w-0 flex-1 text-sm text-absent">
            <strong>Shift void — location was off.</strong> It was switched off for {fmtSeconds(shift.location_off_seconds)} and still off at shift end, so the shift does not count.
            {session.can("attendance:correct") && !shift.exception_id && " Log an exception if this was a genuine device failure."}
          </p>
        </div>
      )}

      {shift.override_attendance && (
        <div className="reveal rounded-lg border border-primary/30 bg-primary/8 px-4 py-3 text-sm">
          <strong>Attendance corrected to {shift.override_attendance.replace("_", " ")}.</strong>{" "}
          {shift.override_reason} <span className="text-muted-foreground">— {fmtDate(shift.override_at, tz, "d MMM, HH:mm")}</span>
        </div>
      )}

      {exception && (
        <div className="reveal rounded-lg border border-primary/30 bg-primary/8 px-4 py-3 text-sm">
          <strong>Exception logged ({exception.category.replace("_", " ")}).</strong> {exception.reason}{" "}
          <span className="text-muted-foreground">— {exception.profiles?.full_name}, {fmtDate(exception.created_at, tz, "d MMM, HH:mm")}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Status" value={<ShiftStatusBadge status={shift.status as never} />} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Attendance" value={<AttendanceBadge status={shift.attendance as never} />} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Worked" value={shift.worked_minutes ? fmtMinutes(shift.worked_minutes) : "—"} hint={shift.late_by_min > 0 ? `${shift.late_by_min} min late` : "On time"} style={{ ["--i" as string]: 3 }} />
        <StatTile
          label="Away from site"
          value={fmtSeconds(awaySeconds)}
          tone={awaySeconds > 1800 ? "half-day" : "neutral"}
          hint={
            worst
              ? `${intervals.length} trip${intervals.length === 1 ? "" : "s"} out · longest ${fmtSeconds(worst.seconds)}`
              : awaySeconds > 0
                ? "Recorded during the shift"
                : "Never left the fence"
          }
          style={{ ["--i" as string]: 4 }}
        />
        <StatTile label="Trust" value={<TrustBadge trust={shift.trust as never} />} hint={shift.flags.length ? shift.flags.map((f: string) => FLAG_LABELS[f] ?? f).join(" · ") : "No flags"} style={{ ["--i" as string]: 5 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-4">
          <Section title="Where the guard was" description="Fence, leeway ring and the shift's breadcrumb trail" bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
            <ShiftMap
              site={fenceSite}
              pings={pings}
              start={shift.start_lat != null ? { lat: shift.start_lat, lng: shift.start_lng, label: `Check-in ${fmtTime(shift.start_captured_at ?? shift.started_at, tz)}` } : null}
              end={shift.end_lat != null ? { lat: shift.end_lat, lng: shift.end_lng, label: `Check-out ${fmtTime(shift.end_captured_at ?? shift.ended_at, tz)}` } : null}
              className="h-[380px] w-full overflow-hidden rounded-b-lg"
            />
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <PunchCard
              title="Check-in"
              selfie={startSelfie}
              time={fmtTime(shift.start_captured_at ?? shift.started_at, tz)}
              serverTime={shift.started_at ? fmtTime(shift.started_at, tz) : null}
              inFence={shift.start_in_fence}
              distance={shift.start_distance_m}
              accuracy={shift.start_accuracy_m}
              device={device}
              index={7}
            />
            <PunchCard
              title="Check-out"
              selfie={endSelfie}
              time={fmtTime(shift.end_captured_at ?? shift.ended_at, tz)}
              serverTime={shift.ended_at ? fmtTime(shift.ended_at, tz) : null}
              inFence={shift.end_in_fence}
              distance={null}
              accuracy={shift.end_accuracy_m}
              device={device}
              index={8}
            />
          </div>

          {(intervals.length > 0 || gaps.length > 0) && (
            <Section title="Time away and tracking gaps" description="Computed from fence transitions in the trail" bodyClassName="p-0" style={{ ["--i" as string]: 9 }}>
              <ul className="divide-y">
                {intervals.slice(0, 8).map((iv, i) => (
                  <li key={`away-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <StatusPill tone="half-day" size="xs" dot={false}>outside</StatusPill>
                    <Mono className="text-muted-foreground">{fmtTime(iv.from, tz)} → {fmtTime(iv.to, tz)}</Mono>
                    <span className="ml-auto">{fmtSeconds(iv.seconds)}</span>
                    {iv.maxDistanceM != null && <Mono className="w-20 text-right text-muted-foreground">{fmtDistance(iv.maxDistanceM)}</Mono>}
                  </li>
                ))}
                {gaps.slice(0, 8).map((g, i) => (
                  <li key={`gap-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <StatusPill tone="absent" size="xs" dot={false}>no signal</StatusPill>
                    <Mono className="text-muted-foreground">{fmtTime(g.from, tz)} → {fmtTime(g.to, tz)}</Mono>
                    <span className="ml-auto">{fmtMinutes(g.minutes)}</span>
                  </li>
                ))}
                {intervals.length + gaps.length > 16 && (
                  <li className="px-4 py-2 text-xs text-muted-foreground">
                    {intervals.length + gaps.length - 16} more not shown.
                  </li>
                )}
              </ul>
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Shift timeline" bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
            {events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No events recorded.</p>
            ) : (
              <ol className="divide-y">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3 px-4 py-2.5">
                    <Mono className="w-12 shrink-0 text-muted-foreground">{fmtTime(e.created_at, tz)}</Mono>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-snug">{e.title}</div>
                      <StatusPill tone={SEVERITY_TONE[e.severity as keyof typeof SEVERITY_TONE]} size="xs" dot={false} className="mt-1">
                        {EVENT_META[e.type as keyof typeof EVENT_META]?.label ?? e.type}
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Capture details" style={{ ["--i" as string]: 7 }}>
            <KvList
              items={[
                { k: "Scheduled", v: <Mono>{fmtTime(shift.scheduled_start, tz)} – {fmtTime(shift.scheduled_end, tz)}</Mono> },
                {
                  k: "Location",
                  v:
                    shift.location_off_seconds > 0 || !shift.location_enabled ? (
                      <span className="text-absent">
                        Off for {fmtSeconds(shift.location_off_seconds)}
                        {!shift.location_enabled && shift.status === "in_progress" ? " — still off" : ""}
                      </span>
                    ) : (
                      "On throughout"
                    ),
                },
                { k: "Pings", v: <Mono>{pings.length}</Mono> },
                { k: "Device", v: device.model ? <>{device.model} <Mono className="text-muted-foreground">v{device.app_version ?? "?"}</Mono></> : "—" },
                { k: "Battery at start", v: device.battery_pct != null ? <Mono>{device.battery_pct}%</Mono> : "—" },
                { k: "Mock GPS", v: device.is_mock ? <span className="text-absent">Detected</span> : "Not detected" },
              ]}
            />
          </Section>

          {audit.length > 0 && (
            <Section title="Audit trail" bodyClassName="p-0" style={{ ["--i" as string]: 8 }}>
              <ul className="divide-y">
                {audit.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="text-[13px] font-medium">{a.action.replace(/_/g, " ")}</div>
                    {a.reason && <p className="text-xs text-muted-foreground">“{a.reason}”</p>}
                    <Mono className="text-[11px] text-muted-foreground">
                      {(a.profiles as { full_name?: string } | null)?.full_name ?? "System"} · {fmtDate(a.created_at, tz, "d MMM, HH:mm")}
                    </Mono>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function PunchCard({
  title,
  selfie,
  time,
  serverTime,
  inFence,
  distance,
  accuracy,
  device,
  index,
}: {
  title: string;
  selfie: string | null;
  time: string;
  serverTime: string | null;
  inFence: boolean | null;
  distance: number | null;
  accuracy: number | null;
  device: { battery_pct?: number };
  index: number;
}) {
  const captured = time !== "—";
  return (
    <Section title={title} style={{ ["--i" as string]: index }} bodyClassName="p-0">
      <div className="flex gap-3 p-3">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {selfie ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfie} alt={`${title} selfie`} className="size-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageOff className="size-4" />
              <span className="text-[10px]">{captured ? "no selfie" : "not captured"}</span>
            </div>
          )}
        </div>
        <dl className="min-w-0 flex-1 space-y-1 text-xs">
          <Row icon={<Crosshair className="size-3" />} label="Time">
            <Mono>{time}</Mono>
            {serverTime && serverTime !== time && <span className="ml-1 text-muted-foreground">(server {serverTime})</span>}
          </Row>
          <Row icon={<MapPin className="size-3" />} label="Fence">
            {inFence == null ? "—" : inFence ? <span className="text-present">Inside</span> : <span className="text-half-day-foreground dark:text-half-day">Outside{distance ? ` by ${fmtDistance(distance)}` : ""}</span>}
          </Row>
          <Row icon={<Crosshair className="size-3" />} label="GPS accuracy">
            <Mono>{accuracy != null ? `±${Math.round(accuracy)} m` : "—"}</Mono>
          </Row>
          <Row icon={device.battery_pct != null && device.battery_pct < 15 ? <BatteryLow className="size-3" /> : <Smartphone className="size-3" />} label="Battery">
            <Mono>{device.battery_pct != null ? `${device.battery_pct}%` : "—"}</Mono>
          </Row>
        </dl>
      </div>
    </Section>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}
