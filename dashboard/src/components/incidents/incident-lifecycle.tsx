"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/components/gf/form-alert";
import { nextStatuses } from "@/lib/domain/incidents";
import type { IncidentStatus } from "@/lib/supabase/types";
import { setIncidentStatus, type ActionState } from "@/app/(app)/incidents/actions";

const ICON: Record<IncidentStatus, typeof Check> = {
  open: RotateCcw,
  investigating: Search,
  resolved: Check,
};

const VERB: Record<IncidentStatus, string> = {
  open: "Re-open",
  investigating: "Take it up",
  resolved: "Resolve",
};

/**
 * Open → investigating → resolved, and back again when something new turns up. Closing
 * needs a note, because that note is the answer the client gets.
 */
export function IncidentLifecycle({
  incidentId,
  status,
  resolution,
  canWrite,
}: {
  incidentId: string;
  status: IncidentStatus;
  resolution: string | null;
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setIncidentStatus, undefined);
  const [closing, setClosing] = useState(false);
  const moves = nextStatuses(status);

  if (!canWrite) {
    return (
      <p className="text-sm text-muted-foreground">
        {status === "resolved"
          ? "This incident is closed."
          : "Ask a supervisor or the owner to take this up — you have read-only access to incidents."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {status === "resolved" && resolution && (
        <div className="rounded-md border border-present/25 bg-present/8 px-3 py-2 text-sm">
          <div className="eyebrow mb-1 text-present">How it was resolved</div>
          {resolution}
        </div>
      )}

      {closing ? (
        <form action={action} className="flex flex-col gap-2.5">
          <input type="hidden" name="incident_id" value={incidentId} />
          <input type="hidden" name="status" value="resolved" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inc-resolution">How was it resolved?</Label>
            <Textarea
              id="inc-resolution"
              name="resolution"
              rows={4}
              required
              defaultValue={resolution ?? ""}
              placeholder="What was done, who was informed, and what changes on the post from now on."
            />
          </div>
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}Resolve incident
            </Button>
            <Button type="button" variant="outline" onClick={() => setClosing(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {moves.map((next) => {
            const Icon = status === "resolved" ? ICON.open : ICON[next];
            if (next === "resolved") {
              return (
                <Button key={next} onClick={() => setClosing(true)}>
                  <Icon data-icon="inline-start" /> {VERB[next]}
                </Button>
              );
            }
            // Coming back from resolved is a re-opening, not a fresh investigation.
            const label = status === "resolved" ? VERB.open : VERB[next];
            return (
              <form key={next} action={action}>
                <input type="hidden" name="incident_id" value={incidentId} />
                <input type="hidden" name="status" value={next} />
                <Button type="submit" variant="outline" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <Icon data-icon="inline-start" />}
                  {label}
                </Button>
              </form>
            );
          })}
        </div>
      )}

      {!closing && state?.error && <FormAlert>{state.error}</FormAlert>}
    </div>
  );
}
