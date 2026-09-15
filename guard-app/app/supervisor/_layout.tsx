import { Stack } from "expo-router";
import { usePalette } from "@/ui/usePalette";

/** Supervisor mode is its own stack; the root layout routes here when the staff session opens. */
export default function SupervisorLayout() {
  const p = usePalette();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.paper }, animation: "fade" }} />;
}
