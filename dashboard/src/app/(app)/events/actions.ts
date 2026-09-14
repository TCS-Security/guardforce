"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Acknowledging is a note that a human has seen the alert; it never edits the event. */
export async function acknowledgeEvents(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.can("events:acknowledge")) return;
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ acknowledged_by: session.userId, acknowledged_at: new Date().toISOString() })
    .in("id", ids)
    .is("acknowledged_at", null);
  revalidatePath("/events");
}
