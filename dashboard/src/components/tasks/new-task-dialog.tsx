"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/gf/form-alert";
import { saveTask, type ActionState } from "@/app/(app)/tasks/actions";

type Site = { id: string; name: string };
type Guard = { id: string; full_name: string; site_id: string | null };
type Template = { id: string; title: string; description: string | null; photo_required: boolean };

/** Create a task, optionally starting from a template, and assign it to guards. */
export function NewTaskDialog({ sites, guards, templates }: { sites: Site[]; guards: Guard[]; templates: Template[] }) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("none");
  const [guardIds, setGuardIds] = useState<string[]>([]);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTask, undefined);

  const template = templates.find((t) => t.id === templateId);
  const siteGuards = guards.filter((g) => g.site_id === siteId);
  const otherGuards = guards.filter((g) => g.site_id !== siteId);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" /> New task
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Assigned guards see it in the app and close it with a photo.</DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="site_id" value={siteId} />
            <input type="hidden" name="template_id" value={templateId} />
            <input type="hidden" name="guard_ids" value={guardIds.join(",")} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-site">Site</Label>
                <Select value={siteId} onValueChange={(v) => { setSiteId(v as string); setGuardIds([]); }}>
                  <SelectTrigger id="task-site" className="w-full">
                    <SelectValue>{(v: string) => sites.find((s) => s.id === v)?.name ?? "Pick a site"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-template">Start from</Label>
                <Select value={templateId} onValueChange={(v) => setTemplateId(v as string)}>
                  <SelectTrigger id="task-template" className="w-full">
                    <SelectValue>{(v: string) => (!v || v === "none" ? "Blank task" : (templates.find((t) => t.id === v)?.title ?? "Blank task"))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Blank task</SelectItem>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input key={templateId} id="task-title" name="title" required defaultValue={template?.title ?? ""} placeholder="Main gate check" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-desc">What to do</Label>
              <Textarea key={`d-${templateId}`} id="task-desc" name="description" rows={2} defaultValue={template?.description ?? ""} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-due">Due</Label>
                <Input id="task-due" name="due_at" type="datetime-local" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="photo_required">Photo proof</Label>
                <div className="flex h-8 items-center gap-2.5">
                  <Switch id="photo_required" name="photo_required" defaultChecked={template?.photo_required ?? true} />
                  <span className="text-sm text-muted-foreground">Required to close</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Assign to</Label>
              <div className="max-h-44 overflow-y-auto rounded-md border p-2">
                {siteGuards.length === 0 && otherGuards.length === 0 && <p className="p-2 text-sm text-muted-foreground">No guards available.</p>}
                {siteGuards.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox
                      checked={guardIds.includes(g.id)}
                      onCheckedChange={(v) => setGuardIds((ids) => (v ? [...ids, g.id] : ids.filter((i) => i !== g.id)))}
                    />
                    {g.full_name}
                  </label>
                ))}
                {otherGuards.length > 0 && (
                  <details className="mt-1 border-t pt-1">
                    <summary className="cursor-pointer py-1 text-xs text-muted-foreground">Guards from other sites</summary>
                    {otherGuards.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                        <Checkbox
                          checked={guardIds.includes(g.id)}
                          onCheckedChange={(v) => setGuardIds((ids) => (v ? [...ids, g.id] : ids.filter((i) => i !== g.id)))}
                        />
                        {g.full_name}
                      </label>
                    ))}
                  </details>
                )}
              </div>
            </div>

            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending || guardIds.length === 0}>
                {pending && <Loader2 className="animate-spin" />}Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
