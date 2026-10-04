import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import React, { useRef } from "react";
import { View } from "react-native";
import { radius } from "./theme";

export type CameraHandle = { take: () => Promise<string> };

/** CameraX-backed preview; `take()` returns a JPEG file URI already shrunk to the KB cap. */
export const Camera = React.forwardRef<CameraHandle, { front: boolean; maxKb: number; maxEdge: number }>(function Camera({ front, maxKb, maxEdge }, ref) {
  const cam = useRef<CameraView>(null);
  const [perm, request] = useCameraPermissions();
  React.useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) void request(); }, [perm, request]);
  React.useImperativeHandle(ref, () => ({
    take: async () => {
      const shot = await cam.current!.takePictureAsync({ quality: 0.85, skipProcessing: false });
      return compress(shot.uri, maxKb, maxEdge);
    },
  }));
  return (
    <View style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" }}>
      {perm?.granted ? <CameraView ref={cam} style={{ flex: 1 }} facing={front ? "front" : "back"} mirror={false} /> : null}
    </View>
  );
});

/** Downscale then step down JPEG quality until the file fits the cap (selfie 120 KB, photo 250 KB by default). */
export async function compress(uri: string, maxKb: number, maxEdge: number): Promise<string> {
  let out = uri;
  for (const q of [0.85, 0.7, 0.55, 0.45, 0.35]) {
    const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: maxEdge } }], { compress: q, format: ImageManipulator.SaveFormat.JPEG });
    out = r.uri;
    const info = await FileSystem.getInfoAsync(out);
    if (info.exists && (info.size ?? 0) <= maxKb * 1024) break;
  }
  return out;
}
