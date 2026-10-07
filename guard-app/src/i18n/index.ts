import { getLocales } from "expo-localization";
import { create } from "zustand";
import { en, hi } from "./strings";

export type StringKey = keyof typeof en;
export type Lang = "en" | "hi";

const tables: Record<Lang, Record<StringKey, string>> = { en, hi };

type I18nState = { lang: Lang; setLang: (l: Lang) => void };
export const useI18n = create<I18nState>((set) => ({
  lang: (getLocales()[0]?.languageCode === "hi" ? "hi" : "en") as Lang,
  setLang: (lang) => set({ lang }),
}));

/** `t("otp_body", phone)` fills `{0}`, `{1}` … in order. */
export function t(key: StringKey, ...args: (string | number)[]): string {
  const lang = useI18n.getState().lang;
  const s = tables[lang][key] ?? en[key] ?? key;
  return s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
}

/** Hook form so screens re-render on language change. */
export function useT() {
  const lang = useI18n((s) => s.lang);
  return (key: StringKey, ...args: (string | number)[]) => {
    const s = tables[lang][key] ?? en[key] ?? key;
    return s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
  };
}
