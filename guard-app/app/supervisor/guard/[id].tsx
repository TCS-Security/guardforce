import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, TextInput, ToastAndroid, View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { GuardRecord } from "@/api/staffTypes";
import { staffTime, useCan, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Camera, type CameraHandle } from "@/ui/Camera";
import { Banner, BigButton, Body, Card, Loading, Mono, Pill, Screen, SecondaryButton, Section, TextButton, Title } from "@/ui/components";
import { attendance, docStatus, docType, duration, errorText, kycGap } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

const DOC_TYPES = ["aadhaar", "pan", "police_verification", "guard_kyc", "marksheet"];

type CameraMode = { kind: "selfie" } | { kind: "doc"; type: string };
type PendingDoc = { type: string; uri: string };

function maskAadhaar(v: string): string | null {
  const d = v.replace(/\D/g, "");
  return d.length >= 4 ? `XXXX XXXX ${d.slice(-4)}` : null;
}
function maskPan(v: string): string | null {
  const s = v.toUpperCase().replace(/\s/g, "");
  return s.length >= 8 ? `XXXXX${s.slice(4, 8)}X` : null;
}

export default function GuardRecordScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = staffTime();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStaff((s) => s.me);
  const canKyc = useCan("guards:kyc"); const canWrite = useCan("guards:write");
  const [record, setRecord] = useState<GuardRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraMode | null>(null);
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);
  const [docNumber, setDocNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const cam = useRef<CameraHandle>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try { const r = await staffApi.guardRecord(id); setRecord(r); setError(null); }
    catch (e) { setError(errorText(e)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const path = record?.guard.registration_selfie_path;
    if (path) staffApi.signedUrl("selfies", path).then(setSelfieUrl).catch(() => undefined);
    else setSelfieUrl(null);
  }, [record?.guard.registration_selfie_path]);

  const g = record?.guard;

  const captureSelfie = async () => {
    setBusy(true); setError(null);
    try {
      const uri = await cam.current!.take();
      const path = `${me!.agency.id}/selfies/reg/${id}.jpg`;
      await staffApi.upload("selfies", path, uri);
      await staffApi.setGuardRegistrationSelfie(id, path);
      ToastAndroid.show(t("sup_selfie_saved"), ToastAndroid.SHORT);
      setCamera(null);
      await load();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const saveDoc = async (type: string, uri: string, numberMasked: string | null) => {
    const path = `${me!.agency.id}/kyc/${id}/${type}-${Date.now()}.jpg`;
    await staffApi.upload("kyc-docs", path, uri);
    await staffApi.recordDocument({ guardId: id, type, filePath: path, mimeType: "image/jpeg", numberMasked });
    ToastAndroid.show(t("sup_doc_saved"), ToastAndroid.SHORT);
    await load();
  };

  const captureDoc = async (type: string) => {
    setBusy(true); setError(null);
    try {
      const uri = await cam.current!.take();
      if (type === "aadhaar" || type === "pan") { setPendingDoc({ type, uri }); setDocNumber(""); setCamera(null); }
      else { await saveDoc(type, uri, null); setCamera(null); }
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const confirmPendingDoc = async () => {
    if (!pendingDoc) return;
    setBusy(true); setError(null);
    try {
      const masked = pendingDoc.type === "aadhaar" ? maskAadhaar(docNumber) : pendingDoc.type === "pan" ? maskPan(docNumber) : null;
      await saveDoc(pendingDoc.type, pendingDoc.uri, masked);
      setPendingDoc(null);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const viewDoc = async (docId: string, filePath: string) => {
    if (viewingId === docId) { setViewingId(null); setViewUrl(null); return; }
    try {
      await staffApi.logDocumentAccess(docId, t("sup_doc_access_purpose"));
      const url = await staffApi.signedUrl("kyc-docs", filePath);
      setViewingId(docId); setViewUrl(url);
    } catch (e) { setError(errorText(e)); }
  };

  if (camera) {
    const front = camera.kind === "selfie";
    return (
      <Screen eyebrow={t("sup_record_eyebrow")} title={g?.full_name ?? ""} onBack={() => setCamera(null)} scroll={false}
        bottom={<BigButton text={t("capture")} loading={busy} onPress={() => { void (camera.kind === "selfie" ? captureSelfie() : captureDoc(camera.type)); }} />}>
        <Camera ref={cam} front={front} maxKb={front ? 120 : 250} maxEdge={front ? 720 : 1600} />
      </Screen>
    );
  }

  return (
    <Screen eyebrow={t("sup_record_eyebrow")} title={g?.full_name ?? ""} description={[g?.designation, g?.site_name].filter(Boolean).join(" · ") || null} onBack={() => router.back()}>
      {!record || !g ? <Loading /> : (
        <>
          {error ? <Banner text={error} tone="signal" /> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pill text={g.status === "invited" ? t("sup_status_invited") : g.status} tone={g.status === "active" ? "present" : "neutral"} />
            <Pill text={record.kyc_missing.length ? t("sup_kyc_incomplete") : t("sup_kyc_complete")} tone={record.kyc_missing.length ? "halfDay" : "present"} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {selfieUrl ? <Image source={{ uri: selfieUrl }} style={{ width: 72, height: 72, borderRadius: radius.md }} contentFit="cover" /> : null}
            {selfieUrl
              ? (canWrite ? <TextButton text={t("sup_doc_retake")} onPress={() => setCamera({ kind: "selfie" })} /> : null)
              : (canWrite ? <SecondaryButton text={t("sup_selfie_capture")} onPress={() => setCamera({ kind: "selfie" })} /> : null)}
          </View>

          {g.phone ? <SecondaryButton text={t("sup_call")} onPress={() => { void Linking.openURL(`tel:${g.phone}`); }} /> : null}

          <Section title={t("sup_record_kyc")} />
          {DOC_TYPES.map((type) => {
            const doc = record.documents.find((d) => d.type === type);
            const [label, tone] = docStatus(doc?.status);
            return (
              <Card key={type}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}><Title>{docType(type)}</Title></View>
                  <Pill text={label} tone={tone} />
                </View>
                <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                  {canKyc ? <TextButton text={doc?.file_path ? t("sup_doc_retake") : t("sup_doc_capture")} onPress={() => setCamera({ kind: "doc", type })} /> : null}
                  {doc?.file_path ? <TextButton text={t("sup_doc_view")} onPress={() => { void viewDoc(doc.id, doc.file_path!); }} /> : null}
                </View>
                {pendingDoc?.type === type ? (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <TextInput value={docNumber} onChangeText={setDocNumber} placeholder={t("sup_doc_number")} placeholderTextColor={p.muted}
                      style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 10, fontFamily: fonts.body, fontSize: 14, color: p.ink }} />
                    <BigButton text={t("sup_doc_save")} loading={busy} onPress={() => { void confirmPendingDoc(); }} />
                  </View>
                ) : null}
                {viewingId === doc?.id && viewUrl ? <Image source={{ uri: viewUrl }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.md, marginTop: 8 }} contentFit="cover" /> : null}
              </Card>
            );
          })}
          {record.kyc_missing.length ? <Body muted size={13}>{t("profile_kyc_missing", record.kyc_missing.map(kycGap).join(", "))}</Body> : null}

          <Section title={t("sup_record_shifts")} />
          {!record.shifts.length ? <Body muted size={13}>{t("sup_record_no_shifts")}</Body> : record.shifts.slice(0, 14).map((s) => {
            const [label, tone] = attendance(s.attendance);
            return (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: p.border + "99", gap: 8 }}>
                <View style={{ width: 68 }}><Mono>{tt.day(s.shift_date)}</Mono></View>
                <View style={{ flex: 1 }}><Body size={13}>{s.site_name ?? "–"}</Body></View>
                <Pill text={label} tone={tone} />
                <Mono>{duration(s.worked_minutes * 60)}</Mono>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
