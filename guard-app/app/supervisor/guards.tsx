import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { GuardListItem } from "@/api/staffTypes";
import { useCan, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Card, EmptyState, Loading, Mono, Pill, Screen, Title } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

export default function GuardsScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const me = useStaff((s) => s.me);
  const canAdd = useCan("guards:write");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [guards, setGuards] = useState<GuardListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setGuards(null);
    staffApi.guards(siteId)
      .then((list) => { if (live) { setGuards(list); setError(null); } })
      .catch((e) => { if (live) { setError(errorText(e)); setGuards([]); } });
    return () => { live = false; };
  }, [siteId]);

  const filtered = useMemo(() => {
    if (!guards) return null;
    const q = query.trim().toLowerCase();
    if (!q) return guards;
    return guards.filter((g) => g.full_name.toLowerCase().includes(q) || (g.employee_code ?? "").toLowerCase().includes(q));
  }, [guards, query]);

  const chip = (id: string | null, label: string) => (
    <Pressable key={id ?? "all"} onPress={() => setSiteId(id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: siteId === id ? p.olive : p.border, backgroundColor: siteId === id ? p.oliveSoft : p.card }}>
      <Body>{label}</Body>
    </Pressable>
  );

  return (
    <Screen eyebrow={t("sup_guards_eyebrow")} title={t("sup_guards_title")} onBack={() => router.back()}
      bottom={canAdd ? <BigButton text={t("sup_add_guard")} onPress={() => router.push("/supervisor/guard/new" as never)} /> : undefined}>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {chip(null, t("sup_all_sites"))}
        {(me?.sites ?? []).map((s) => chip(s.id, s.name))}
      </View>
      <TextInput value={query} onChangeText={setQuery} placeholder={t("sup_search")} placeholderTextColor={p.muted}
        style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink }} />
      {error ? <Banner text={error} tone="signal" /> : null}
      {filtered == null ? <Loading /> : !filtered.length ? <EmptyState text={t("sup_guards_none")} /> : filtered.map((g) => (
        <Card key={g.id} onPress={() => router.push({ pathname: "/supervisor/guard/[id]", params: { id: g.id } } as never)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Title>{g.full_name}</Title>
              <Mono>{[g.employee_code ?? "–", g.designation].filter(Boolean).join(" · ")}</Mono>
              <Body muted size={13}>{g.site_name ?? "–"}</Body>
            </View>
            <View style={{ gap: 6, alignItems: "flex-end" }}>
              {g.status === "invited" ? <Pill text={t("sup_status_invited")} tone="neutral" /> : null}
              {g.on_duty ? <Pill text={t("sup_on_duty")} tone="present" /> : null}
              <Pill text={g.kyc_complete ? t("sup_kyc_complete") : t("sup_kyc_incomplete")} tone={g.kyc_complete ? "present" : "halfDay"} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
