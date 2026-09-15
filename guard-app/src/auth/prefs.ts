import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/** Small identity facts and the local PIN hash (for offline unlock). The Supabase session is stored by supabase-js. */
const get = (k: string) => SecureStore.getItemAsync(k);
const set = (k: string, v: string | null) => (v == null ? SecureStore.deleteItemAsync(k) : SecureStore.setItemAsync(k, v));

export const prefs = {
  installId: async () => { let v = await get("install_id"); if (!v) { v = Crypto.randomUUID(); await set("install_id", v); } return v; },
  guardId: () => get("guard_id"), setGuardId: (v: string | null) => set("guard_id", v),
  agencyId: () => get("agency_id"), setAgencyId: (v: string | null) => set("agency_id", v),
  guardName: () => get("guard_name"), setGuardName: (v: string | null) => set("guard_name", v),
  phone: () => get("phone"), setPhone: (v: string | null) => set("phone", v),
  permissionsDone: async () => (await get("permissions_done")) === "1", setPermissionsDone: (v: boolean) => set("permissions_done", v ? "1" : null),
  hasLocalPin: async () => !!(await get("pin_hash")),
  saveLocalPin: async (pin: string) => {
    const salt = Crypto.randomUUID();
    await set("pin_salt", salt);
    await set("pin_hash", await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`));
  },
  checkLocalPin: async (pin: string) => {
    const salt = await get("pin_salt"), hash = await get("pin_hash");
    if (!salt || !hash) return false;
    return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`)) === hash;
  },
  clear: async () => { for (const k of ["guard_id", "agency_id", "guard_name", "phone", "permissions_done", "pin_salt", "pin_hash"]) await set(k, null); },
};
