import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { setRegistrationSelfie, useStore } from "@/data/store";
import { useT } from "@/i18n";
import { Camera, type CameraHandle } from "@/ui/Camera";
import { BigButton, Screen, SecondaryButton } from "@/ui/components";
import { radius } from "@/ui/theme";

export default function RegistrationSelfieScreen() {
  const t = useT(); const router = useRouter(); const { again } = useLocalSearchParams<{ again?: string }>();
  const cam = useRef<CameraHandle>(null);
  const maxKb = useStore((s) => s.me?.config?.selfie_max_kb ?? 120);
  const [shot, setShot] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return (
    <Screen eyebrow={t("selfie_reg_eyebrow")} title={t("selfie_reg_title")} description={t("selfie_reg_body")} onBack={again ? () => router.back() : undefined} scroll={false}
      bottom={shot == null
        ? <BigButton text={t("capture")} loading={busy} onPress={async () => { setBusy(true); try { setShot(await cam.current!.take()); } finally { setBusy(false); } }} />
        : <>
          <BigButton text={t("selfie_reg_done")} loading={busy} onPress={async () => { setBusy(true); await setRegistrationSelfie(shot); setBusy(false); if (again) router.back(); else router.replace("/home"); }} />
          <SecondaryButton text={t("retake")} onPress={() => setShot(null)} />
        </>}>
      {shot == null ? <Camera ref={cam} front maxKb={maxKb} maxEdge={720} /> : <Image source={{ uri: shot }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg }} contentFit="cover" />}
    </Screen>
  );
}
