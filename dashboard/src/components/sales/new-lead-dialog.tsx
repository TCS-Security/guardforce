"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/gf/form-alert";
import { SEGMENTS, type Segment } from "@/lib/domain/sales";
import { createLead, type ActionState } from "@/app/(app)/sales/actions";

const UNIT_FOR: Partial<Record<Segment, string>> = {
  apartment: "flats", developer_project: "flats", hospital: "beds", school: "students", college: "students", hotel: "rooms", factory: "acres",
};

/** Add a lead by hand: a place a rep heard about, walked past, or got referred to. */
export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<Segment>("apartment");
  const [state, action, pending] = useActionState<ActionState, FormData>(createLead, undefined);
  const designations = SEGMENTS[segment].designations;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" /> Add lead
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a lead</DialogTitle>
            <DialogDescription>Only the name and type are needed. Fill in what you know; you can add more later.</DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="segment" value={segment} />
            <input type="hidden" name="size_unit" value={UNIT_FOR[segment] ?? "guards"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="nl-name">Name</Label>
                <Input id="nl-name" name="name" required placeholder="e.g. Green Meadows Residency" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-type">Type</Label>
                <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                  <SelectTrigger id="nl-type" className="w-full">
                    <SelectValue>{(v: string) => SEGMENTS[v as Segment]?.label ?? "Pick a type"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEGMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-size">Size ({UNIT_FOR[segment] ?? "guards"})</Label>
                <Input id="nl-size" name="size_value" inputMode="numeric" placeholder="optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-locality">Area</Label>
                <Input id="nl-locality" name="locality" placeholder="e.g. Whitefield" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-phone">Main phone</Label>
                <Input id="nl-phone" name="phone" inputMode="tel" placeholder="Reception / security desk" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="nl-address">Address</Label>
                <Input id="nl-address" name="address" placeholder="optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-contact">Person to call</Label>
                <Input id="nl-contact" name="contact_name" placeholder="Name (optional)" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-designation">Their designation</Label>
                <Input id="nl-designation" name="designation" list="nl-designations" placeholder={designations[0]} />
                <datalist id="nl-designations">
                  {designations.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-contact-phone">Their mobile</Label>
                <Input id="nl-contact-phone" name="contact_phone" inputMode="tel" placeholder="optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nl-agency">Current agency (if known)</Label>
                <Input id="nl-agency" name="incumbent_agency" placeholder="optional" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="nl-note">Note</Label>
                <Textarea id="nl-note" name="note" rows={2} placeholder="How you heard about it, what they need…" />
              </div>
            </div>
            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>Add lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
