"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/gf/form-alert";
import { addPatrolNote, type ActionState } from "@/app/(app)/patrols/actions";

export function PatrolNote({ patrolId, note, canEdit }: { patrolId: string; note: string | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addPatrolNote, undefined);

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">{note || "No note on this round."}</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="patrol_id" value={patrolId} />
      <Textarea name="notes" rows={3} defaultValue={note ?? ""} placeholder="Anything the next shift should know about this round" aria-label="Supervisor note" />
      {state?.error && <FormAlert>{state.error}</FormAlert>}
      {state?.ok && <FormAlert tone="success">Note saved.</FormAlert>}
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}Save note
        </Button>
      </div>
    </form>
  );
}
