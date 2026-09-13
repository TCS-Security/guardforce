import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AlertItem = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  payload: Record<string, unknown>;
};

/** The alert bell's initial payload — rendered on the server so there is no flash of "no alerts". */
export async function loadRecentAlerts(limit = 12): Promise<AlertItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,title,body,created_at,read_at,payload")
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AlertItem[];
}
