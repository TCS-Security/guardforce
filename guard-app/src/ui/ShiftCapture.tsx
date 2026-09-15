import { Image } from "expo-image";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ToastAndroid, View } from "react-native";
import { checkIn, checkOut, fence, recompute, time, useStore } from "@/data/store";
import { distanceOutsideM } from "@/domain/geo";
import { useT } from "@/i18n";
import { Camera, type CameraHandle } from "@/ui/Camera";
import { Banner, BigButton, Body, Eyebrow, Screen, SecondaryButton, TextButton } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { radius } from "@/ui/theme";
import { useLocationFix } from "@/ui/useLocationFix";

/** Selfie → GPS fix → confirm, for both shift start (F4) and end. */
export function ShiftCapture({ end }: { end: boolean }) {
  const t = useT(); const router = useRouter(); const tt = time();
  const me = useStore((s) => s.me); const duty = useStore((s) => s.duty); const live = useStore((s) => s.tracking);
  const cam = useRef<CameraHandle>(null);
  const [selfie, setSelfie] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [locationOn, setLocationOn] = useState(true);
  const [openedAt] = useState(() => Date.now());
  const { fix, searching, good } = useLocationFix(selfie != null);
  useEffect(() => { void Location.hasServicesEnabledAsync().then(setLocationOn); }, [selfie]);

  const shift = duty && (duty.kind === "ready" || duty.kind === "upcoming" || duty.kind === "on_duty") ? duty.shift : null;
  const f = fence();
  const dist = fix && f ? distanceOutsideM(f, fix.lat, fix.lng) : null;
  const inside = dist != null && f ? dist <= f.leewayM : null;
  const early = end && shift?.scheduled_end ? openedAt < Date.parse(shift.scheduled_end) - 15 * 60_000 : false;
  const blocked = !!fix?.isMock || (end && live.locationEnabled === false && !locationOn);
  const maxKb = me?.config?.selfie_max_kb ?? 120;

  const submit = async () => {
    if (!selfie || !fix) return;
    setBusy(true); setError(null);
    try {
      if (end) await checkOut({ selfieUri: selfie, lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, isMock: fix.isMock });
      else await checkIn({ selfieUri: selfie, lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, isMock: fix.isMock, shift });
      recompute();
      ToastAndroid.show(end ? t("checkout_done") : t("checkin_done"), ToastAndroid.SHORT);
      router.back();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <Screen eyebrow={end ? t("checkout_eyebrow") : t("checkin_eyebrow")} title={t("checkin_title")} onBack={() => router.back()}
      description={shift ? `${shift.site_name ?? ""} · ${tt.clock(shift.scheduled_start)}–${tt.clock(shift.scheduled_end)}` : me?.site?.name ?? null}
      bottom={selfie == null
        ? <BigButton text={t("capture")} loading={busy} disabled={!locationOn} onPress={async () => { setBusy(true); try { setSelfie(await cam.current!.take()); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }} />
        : <>
          <BigButton text={end ? t("checkout_confirm") : t("checkin_confirm")} disabled={!fix || blocked} loading={busy} tone={end ? "signal" : "olive"} onPress={submit} />
          <SecondaryButton text={t("retake")} onPress={() => setSelfie(null)} />
        </>}>
      {!locationOn ? <Banner text={t("checkin_location_off")} tone="signal" action={<TextButton text={t("home_turn_on")} onPress={() => { void IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS); }} />} /> : null}
      <Eyebrow>{t("checkin_step_selfie")}</Eyebrow>
      {selfie == null ? <Camera ref={cam} front maxKb={maxKb} maxEdge={720} /> : <Image source={{ uri: selfie }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg }} contentFit="cover" />}
      {selfie != null ? <>
        <Eyebrow>{t("checkin_step_gps")}</Eyebrow>
        {!fix && searching ? <Body>{t("checkin_gps_waiting", 0)}</Body>
          : !fix ? <Banner text={t("checkin_location_off")} tone="signal" />
          : fix.isMock ? <Banner text={t("checkin_mock")} tone="signal" />
          : !good && searching ? <Body>{t("checkin_gps_waiting", Math.round(fix.accuracyM ?? 0))}</Body>
          : !good ? <Banner text={t("checkin_gps_weak", Math.round(fix.accuracyM ?? 0))} tone="halfDay" />
          : <Body>{t("checkin_gps_ok", Math.round(fix.accuracyM ?? 0))}</Body>}
        {fix && !fix.isMock ? <>
          <Eyebrow>{t("checkin_step_confirm")}</Eyebrow>
          {inside === true ? <Banner text={t("checkin_inside")} tone="present" /> : inside === false ? <Banner text={t("checkin_outside", Math.round(dist ?? 0))} tone="halfDay" /> : null}
          {early ? <Banner text={t("checkout_early", tt.clock(shift?.scheduled_end))} tone="halfDay" /> : null}
          {end && live.locationEnabled === false ? <Banner text={t("checkout_location_off_warning")} tone="signal" /> : null}
        </> : null}
      </> : null}
      {error ? <Banner text={error} tone="signal" /> : null}
      <View />
    </Screen>
  );
}
