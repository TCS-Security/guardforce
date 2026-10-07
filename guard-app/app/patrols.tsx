import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { refreshHome, time, useStore } from "@/data/store";
import type { PatrolInfo } from "@/api/types";
import { useT } from "@/i18n";
import { Card, EmptyState, Mono, Pill, Screen, Title } from "@/ui/components";
import { duration, patrol as patrolLabel } from "@/ui/labels";

/** Server status overlaid with what this phone did offline. */
export function useEffectivePatrols(): PatrolInfo[] {
  const home = useStore((s) => s.home); const ov = useStore((s) => s.patrolOverrides);
  return (home?.patrols ?? []).map((p) => { const o = ov.find((x) => x.id === p.id); return o ? { ...p, status: o.status === "completed" && p.status === "late" ? "late" : o.status } : p; });
}

export default function PatrolsScreen() {
  const t = useT(); const router = useRouter(); const tt = time();
  const patrols = useEffectivePatrols(); const duty = useStore((s) => s.duty);
  useEffect(() => { void refreshHome(); }, []);
  return (
    <Screen eyebrow={t("patrols_eyebrow")} title={t("patrols_title")} onBack={() => router.back()}>
      {!patrols.length ? <EmptyState text={duty?.kind === "on_duty" ? t("patrols_empty") : t("patrols_need_shift")} /> : null}
      {patrols.map((p) => {
        const [label, tone] = patrolLabel(p.status);
        const actionable = p.status === "scheduled" || p.status === "in_progress" || (p.status === "late" && !p.ended_at);
        return (
          <Card key={p.id} onPress={actionable ? () => router.push(`/patrol/${p.id}` as never) : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><Title>{p.route_name ?? "Patrol"}</Title></View><Pill text={label} tone={tone} /></View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <Mono>{t("patrol_expected", tt.clock(p.expected_at))}</Mono>
              {p.duration_s != null ? <Mono>{duration(p.duration_s)}</Mono> : null}
              {p.distance_m != null ? <Mono>{`${Math.round(p.distance_m)} m`}</Mono> : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
