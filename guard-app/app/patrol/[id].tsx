import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { completePatrol, patrolPhotoPath, startPatrol, time, useStore } from "@/data/store";
import { overrides } from "@/data/db";
import type { LocalPhoto } from "@/data/payloads";
import { GuardTracking } from "../../modules/guard-tracking";
import { useT } from "@/i18n";
import { Camera, type CameraHandle } from "@/ui/Camera";
import { Banner, BigButton, Card, Display, Mono, Screen, SecondaryButton, Title } from "@/ui/components";
import { duration, errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";
import { quickFix } from "@/ui/useLocationFix";
import { useEffectivePatrols } from "../patrols";

export default function PatrolRunScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = time();
  const { id } = useLocalSearchParams<{ id: string }>();
  const patrol = useEffectivePatrols().find((x) => x.id === id);
  const me = useStore((s) => s.me);
  const cam = useRef<CameraHandle>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]); const [notes, setNotes] = useState(""); const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null); const [tick, setTick] = useState(() => Date.now()); const [points, setPoints] = useState(0);
  const required = me?.site?.patrol_photo_required ? patrol?.min_photos ?? 1 : 0;
  const maxKb = me?.config?.photo_max_kb ?? 250;

  useEffect(() => {
    if (!patrol || startedAt) return;
    const s = patrol.started_at ? Date.parse(patrol.started_at) : overrides.get("patrol", patrol.id)?.at;
    if (s) setStartedAt(s);
  }, [patrol?.status]);
  useEffect(() => {
    if (!startedAt) return;
    const i = setInterval(() => { setTick(Date.now()); GuardTracking.trail(id).then((tr) => setPoints(tr.length)).catch(() => undefined); }, 2000);
    return () => clearInterval(i);
  }, [startedAt]);
  const running = startedAt != null;
  const elapsed = startedAt ? Math.max(0, Math.floor((tick - startedAt) / 1000)) : 0;

  return (
    <Screen eyebrow={t("patrols_eyebrow")} title={patrol?.route_name ?? t("patrol_run_title")} onBack={() => (camera ? setCamera(false) : router.back())}
      description={patrol?.expected_at ? t("patrol_expected", tt.clock(patrol.expected_at)) : null} scroll={!camera}
      bottom={camera
        ? <>
          <BigButton text={t("capture")} loading={busy} onPress={async () => {
            setBusy(true);
            try { const file = await cam.current!.take(); const loc = await quickFix(); setPhotos((ph) => [...ph, { file, remotePath: patrolPhotoPath(id), lat: loc?.lat, lng: loc?.lng, takenAt: new Date().toISOString() }]); setCamera(false); }
            catch (e) { setError(errorText(e)); } finally { setBusy(false); }
          }} />
          <SecondaryButton text={t("cancel")} onPress={() => setCamera(false)} />
        </>
        : !running
          ? <BigButton text={t("patrol_start")} loading={busy} onPress={async () => { setBusy(true); await startPatrol(id); setStartedAt(Date.now()); setBusy(false); }} />
          : <>
            <SecondaryButton text={t("patrol_add_photo")} onPress={() => setCamera(true)} />
            <BigButton text={t("patrol_complete")} disabled={photos.length < required} loading={busy} onPress={async () => {
              setBusy(true); try { await completePatrol(id, photos, notes); router.back(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
            }} />
          </>}>
      {camera ? <Camera ref={cam} front={false} maxKb={maxKb} maxEdge={1280} /> : <>
        {running ? <Card><Display size={32}>{elapsed < 60 ? `${elapsed}s` : duration(elapsed)}</Display><Mono>{t("patrol_elapsed", tt.clock(startedAt!), points)}</Mono></Card> : null}
        {required > 0 ? <Banner text={t("patrol_photo_required", required)} tone={photos.length >= required ? "present" : "halfDay"} /> : null}
        <Title>{t("patrol_photos", photos.length, required)}</Title>
        {photos.length ? <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{photos.map((ph) => <Image key={ph.file} source={{ uri: ph.file }} style={{ width: 96, height: 96, borderRadius: radius.sm }} contentFit="cover" />)}</ScrollView> : null}
        {running ? <TextInput value={notes} onChangeText={setNotes} placeholder={t("patrol_notes")} placeholderTextColor={p.muted} multiline style={{ minHeight: 72, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink, textAlignVertical: "top" }} /> : null}
        {error ? <Banner text={error} tone="signal" /> : null}
        <View />
      </>}
    </Screen>
  );
}
