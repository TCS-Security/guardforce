import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { TextInput, ToastAndroid, View } from "react-native";
import { completeTask, startTask, taskPhotoPath, time, useStore } from "@/data/store";
import type { LocalPhoto } from "@/data/payloads";
import { useT } from "@/i18n";
import { Camera, type CameraHandle } from "@/ui/Camera";
import { Banner, BigButton, Mono, Screen, SecondaryButton } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";
import { quickFix } from "@/ui/useLocationFix";
import { useEffectiveTasks } from "../tasks";

export default function TaskDoScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = time();
  const { id } = useLocalSearchParams<{ id: string }>();
  const home = useStore((s) => s.home); const me = useStore((s) => s.me);
  const task = useEffectiveTasks().find((x) => x.id === id) ?? home?.tasks.find((x) => x.id === id);
  const cam = useRef<CameraHandle>(null);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null); const [note, setNote] = useState(""); const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const needPhoto = !!task?.photo_required; const maxKb = me?.config?.photo_max_kb ?? 250;
  useEffect(() => { if (task?.status === "pending") void startTask(id); }, [id]);
  return (
    <Screen eyebrow={t("tasks_eyebrow")} title={task?.title ?? ""} description={task?.description ?? null} onBack={() => (camera ? setCamera(false) : router.back())} scroll={!camera}
      bottom={camera
        ? <>
          <BigButton text={t("capture")} loading={busy} onPress={async () => {
            setBusy(true);
            try { const file = await cam.current!.take(); const loc = await quickFix(); setPhoto({ file, remotePath: taskPhotoPath(id), lat: loc?.lat, lng: loc?.lng, takenAt: new Date().toISOString() }); setCamera(false); }
            catch (e) { setError(errorText(e)); } finally { setBusy(false); }
          }} />
          <SecondaryButton text={t("cancel")} onPress={() => setCamera(false)} />
        </>
        : <>
          <SecondaryButton text={t("task_take_photo")} onPress={() => setCamera(true)} />
          <BigButton text={t("task_complete")} disabled={!task || (needPhoto && !photo)} loading={busy} onPress={async () => {
            setBusy(true);
            try { const loc = photo ? null : await quickFix(); await completeTask(id, photo, note, photo?.lat ?? loc?.lat ?? null, photo?.lng ?? loc?.lng ?? null); ToastAndroid.show(t("task_done"), ToastAndroid.SHORT); router.back(); }
            catch (e) { setError(errorText(e)); } finally { setBusy(false); }
          }} />
        </>}>
      {camera ? <Camera ref={cam} front={false} maxKb={maxKb} maxEdge={1280} /> : <>
        {task?.due_at ? <Mono>{t("task_due", tt.clock(task.due_at))}</Mono> : null}
        {needPhoto ? <Banner text={t("task_photo_required")} tone={photo ? "present" : "halfDay"} /> : null}
        {photo ? <Image source={{ uri: photo.file }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md }} contentFit="cover" /> : null}
        <TextInput value={note} onChangeText={setNote} placeholder={t("task_note")} placeholderTextColor={p.muted} multiline style={{ minHeight: 72, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink, textAlignVertical: "top" }} />
        {error ? <Banner text={error} tone="signal" /> : null}
        <View />
      </>}
    </Screen>
  );
}
