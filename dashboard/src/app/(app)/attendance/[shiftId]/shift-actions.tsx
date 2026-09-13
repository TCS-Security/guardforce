"use client";

import { useActionState, useState } from "react";
import { Loader2, PencilLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/gf/form-alert";
import { logShiftException, overrideAttendance, type ActionState } from "../actions";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "on_leave", label: "On leave" },
];

const CATEGORIES = [
  { value: "device_failure", label: "Phone or battery failure" },
  { value: "gps_failure", label: "GPS not working" },
  { value: "network", label: "No network at the post" },
  { value: "other", label: "Other" },
];

/** AUD-1 correction dialog. */
export function OverrideAttendanceButton({ shiftId, current }: { shiftId: string; current: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current === "pending" ? "present" : current);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await overrideAttendance(prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  }, undefined);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilLine data-icon="inline-start" /> Correct attendance
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Correct attendance</DialogTitle>
            <DialogDescription>The original record is kept. Your name, the time and this reason go into the audit trail.</DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="shift_id" value={shiftId} />
            <input type="hidden" name="attendance" value={value} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="att-value">Mark as</Label>
              <Select value={value} onValueChange={(v) => setValue(v as string)}>
                <SelectTrigger id="att-value" className="w-full">
                  <SelectValue>{(v: string) => ATTENDANCE_OPTIONS.find((o) => o.value === v)?.label ?? "Present"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="att-reason">Reason</Label>
              <Textarea id="att-reason" name="reason" rows={3} required minLength={5} placeholder="Guard was present; client confirmed. Phone battery died before check-in." />
            </div>
            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save correction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** LOC-3 exception dialog: rescues a shift voided by location being off. */
export function LogExceptionButton({ shiftId }: { shiftId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("device_failure");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await logShiftException(prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  }, undefined);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck data-icon="inline-start" /> Log an exception
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a technical exception</DialogTitle>
            <DialogDescription>
              Use this when location was genuinely unavailable — a dead phone, broken GPS, no signal. The shift will count and the exception stays on the record.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="shift_id" value={shiftId} />
            <input type="hidden" name="category" value={category} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exc-category">What happened</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as string)}>
                <SelectTrigger id="exc-category" className="w-full">
                  <SelectValue>{(v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? "Phone or battery failure"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exc-reason">Details</Label>
              <Textarea id="exc-reason" name="reason" rows={3} required minLength={10} placeholder="Handset died at 02:00; supervisor confirmed the guard was at the gate until 06:00." />
            </div>
            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Log exception</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
