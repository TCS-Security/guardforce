import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ToastAndroid, View } from "react-native";
import { ApiError } from "@/api/errors";
import { staffApi } from "@/api/staffApi";
import type { GuardListItem, RosterAssignment, ShiftType } from "@/api/staffTypes";
import { staffTime, useCan, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Card, EmptyState, Loading, Mono, Pill, Screen, Section, TextButton, Title } from "@/ui/components";
import { attendance, errorText } from "@/ui/labels";
import { usePalette } from "@/ui/usePalette";

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function RosterScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = staffTime();
  const me = useStaff((s) => s.me);
  const canAssign = useCan("roster:write");
  const [date, setDate] = useState(tt.todayIso());
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  const [rows, setRows] = useState<RosterAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await staffApi.roster(date, siteFilter)); setError(null); }
    catch (e) { setError(errorText(e)); setRows((r) => r ?? []); }
  }, [date, siteFilter]);
  useEffect(() => { setRows(null); void load(); }, [load]);

  const [assigning, setAssigning] = useState(false);
  const [formSite, setFormSite] = useState<string | null>(me?.sites[0]?.id ?? null);
  const [guards, setGuards] = useState<GuardListItem[] | null>(null);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[] | null>(null);
  const [shiftTypeId, setShiftTypeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [kycBlocked, setKycBlocked] = useState(false);

  useEffect(() => {
    if (!assigning || !formSite) return;
    setGuards(null); setGuardId(null); setShiftTypes(null); setShiftTypeId(null); setKycBlocked(false); setFormError(null);
    staffApi.guards(formSite).then(setGuards).catch(() => setGuards([]));
    staffApi.shiftTypes(formSite).then((types) => { setShiftTypes(types); setShiftTypeId(types[0]?.id ?? null); }).catch(() => setShiftTypes([]));
  }, [assigning, formSite]);

  const siteChip = (id: string | null, label: string, selected: string | null, onSelect: (id: string | null) => void) => (
    <Pressable key={id ?? "all"} onPress={() => onSelect(id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: selected === id ? p.olive : p.border, backgroundColor: selected === id ? p.oliveSoft : p.card }}>
      <Body>{label}</Body>
    </Pressable>
  );

  const bySite = new Map<string, { name: string; rows: RosterAssignment[] }>();
  (rows ?? []).forEach((r) => {
    const key = r.site_id;
    const entry = bySite.get(key) ?? { name: r.site_name ?? key, rows: [] };
    entry.rows.push(r);
    bySite.set(key, entry);
  });

  const submitAssign = async () => {
    if (!formSite || !guardId || !shiftTypeId) return;
    setBusy(true); setFormError(null); setKycBlocked(false);
    try {
      await staffApi.assignShift(guardId, formSite, shiftTypeId, date);
      ToastAndroid.show(t("sup_assign_done"), ToastAndroid.SHORT);
      setAssigning(false);
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (/KYC/i.test(msg)) setKycBlocked(true);
      else setFormError(errorText(e));
    } finally { setBusy(false); }
  };

  return (
    <Screen eyebrow={t("sup_roster_eyebrow")} title={t("sup_roster_title")} onBack={() => router.back()}
      bottom={canAssign ? <BigButton text={t("sup_assign")} onPress={() => setAssigning((a) => !a)} /> : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TextButton text={t("sup_prev_day")} onPress={() => setDate((d) => shiftDate(d, -1))} />
        <View style={{ flex: 1, alignItems: "center" }}><Mono size={15}>{tt.day(date)}</Mono></View>
        <TextButton text={t("sup_next_day")} onPress={() => setDate((d) => shiftDate(d, 1))} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {siteChip(null, t("sup_all_sites"), siteFilter, setSiteFilter)}
        {(me?.sites ?? []).map((s) => siteChip(s.id, s.name, siteFilter, setSiteFilter))}
      </View>

      {assigning ? (
        <Card>
          <Title>{t("sup_assign")}</Title>
          <View style={{ height: 8 }} />
          <Body muted size={12}>{t("sup_field_site")}</Body>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(me?.sites ?? []).map((s) => siteChip(s.id, s.name, formSite, setFormSite))}
          </View>

          <View style={{ height: 8 }} />
          <Body muted size={12}>{t("sup_assign_guard")}</Body>
          {guards == null ? <Loading /> : !guards.length ? <EmptyState text={t("sup_guards_none")} /> : (
            <View style={{ gap: 8 }}>
              {guards.map((g) => (
                <Pressable key={g.id} disabled={!g.kyc_complete} onPress={() => setGuardId(g.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: guardId === g.id ? p.olive : p.border, backgroundColor: guardId === g.id ? p.oliveSoft : p.card, opacity: g.kyc_complete ? 1 : 0.5 }}>
                  <View style={{ flex: 1 }}><Body>{g.full_name}</Body></View>
                  <Pill text={g.kyc_complete ? t("sup_kyc_complete") : t("sup_kyc_incomplete")} tone={g.kyc_complete ? "present" : "halfDay"} />
                </Pressable>
              ))}
            </View>
          )}
          {guards?.some((g) => !g.kyc_complete) ? <Body muted size={12}>{t("sup_assign_kyc_blocked")}</Body> : null}

          <View style={{ height: 8 }} />
          <Body muted size={12}>{t("sup_assign_shift_type")}</Body>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(shiftTypes ?? []).map((st) => (
              <Pressable key={st.id} onPress={() => setShiftTypeId(st.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: shiftTypeId === st.id ? p.olive : p.border, backgroundColor: shiftTypeId === st.id ? p.oliveSoft : p.card }}>
                <Body>{`${st.name} ${st.start_time}–${st.end_time}`}</Body>
              </Pressable>
            ))}
          </View>

          <View style={{ height: 12 }} />
          {kycBlocked ? <Banner text={t("sup_assign_kyc_blocked")} tone="signal" /> : null}
          {formError ? <Banner text={formError} tone="signal" /> : null}
          <View style={{ height: 8 }} />
          <BigButton text={t("sup_assign")} loading={busy} disabled={!formSite || !guardId || !shiftTypeId} onPress={() => { void submitAssign(); }} />
        </Card>
      ) : null}

      {error ? <Banner text={error} tone="signal" /> : null}
      {rows == null ? <Loading /> : !rows.length ? <EmptyState text={t("sup_roster_none")} /> : [...bySite.entries()].map(([siteId, entry]) => (
        <View key={siteId}>
          <Section title={entry.name} />
          {entry.rows.map((r) => {
            const [label, tone] = r.attendance ? attendance(r.attendance) : [r.shift_status ?? "", "neutral" as const];
            return (
              <Card key={r.id}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Title>{r.guard_name}</Title>
                    <Mono>{`${r.shift_type ?? "–"} · ${tt.clock(r.scheduled_start)}–${tt.clock(r.scheduled_end)}`}</Mono>
                  </View>
                  {label ? <Pill text={label} tone={tone} /> : null}
                </View>
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
