/** Ten Indian mobile digits from "98…", "+91 98…", "0098…", "098…"; null when not a mobile number. */
export function tenDigits(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("0091")) d = d.slice(4);
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 || !/[6-9]/.test(d[0])) return null;
  return d;
}
export const toE164 = (input: string) => { const d = tenDigits(input); return d ? `+91${d}` : null; };
export function displayPhone(v: string): string {
  const d = tenDigits(v);
  return d ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : v;
}
