import { useRouter } from "expo-router";
import { SetPin } from "@/ui/SetPin";
export default function ChangePinScreen() { const r = useRouter(); return <SetPin onDone={() => r.back()} onBack={() => r.back()} />; }
