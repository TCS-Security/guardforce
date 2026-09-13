"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Eye, Check, X, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { StatusPill } from "@/components/gf/status-pill";
import { DocumentStatusBadge } from "@/components/gf/attendance-badge";
import { DOCUMENT_TYPES } from "@/lib/domain/status";
import { fmtDate, fmtDateTime } from "@/lib/domain/format";
import type { GuardDocument } from "@/lib/supabase/types";
import {
  uploadGuardDocument, viewGuardDocument, verifyGuardDocument, rejectGuardDocument, deleteGuardDocument,
  type UploadDocState,
} from "./actions";

export function KycVault({ guardId, docs, uploaders }: { guardId: string; docs: GuardDocument[]; uploaders: Record<string, string> }) {
  const byType = new Map(docs.map((d) => [d.type, d]));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DOCUMENT_TYPES.map((slot) => (
        <KycSlotCard key={slot.type} guardId={guardId} slot={slot} doc={byType.get(slot.type) ?? null} uploaders={uploaders} />
      ))}
    </div>
  );
}

function KycSlotCard({
  guardId, slot, doc, uploaders,
}: {
  guardId: string;
  slot: (typeof DOCUMENT_TYPES)[number];
  doc: GuardDocument | null;
  uploaders: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const hasFile = !!doc?.file_path;
  const showNumberField = slot.type === "aadhaar" || slot.type === "pan";

  function view() {
    if (!doc) return;
    startTransition(async () => {
      const res = await viewGuardDocument(doc.id, guardId);
      if (res.error) toast.error(res.error);
      else if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  function verify() {
    if (!doc) return;
    startTransition(async () => {
      const res = await verifyGuardDocument(doc.id, guardId);
      if (res?.error) toast.error(res.error);
      else toast.success(`${slot.label} verified`);
    });
  }

  function del() {
    if (!doc) return;
    startTransition(async () => {
      const res = await deleteGuardDocument(doc.id, guardId);
      if (res?.error) toast.error(res.error);
      else toast.success(`${slot.label} deleted`);
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border p-3.5" data-testid={`kyc-slot-${slot.type}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-sm font-semibold">{slot.label}</div>
          {slot.hint && <div className="text-xs text-muted-foreground">{slot.hint}</div>}
        </div>
        {doc ? (
          <DocumentStatusBadge status={doc.status} size="xs" />
        ) : (
          <StatusPill tone={slot.required ? "signal" : "neutral"} size="xs">Missing</StatusPill>
        )}
      </div>

      {doc && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {doc.number_masked && <div className="col-span-2 font-mono tabular text-foreground">{doc.number_masked}</div>}
          {doc.issued_on && <div>Issued {fmtDate(doc.issued_on)}</div>}
          {doc.expires_on && <div>Expires {fmtDate(doc.expires_on)}</div>}
          {doc.uploaded_by && <div className="col-span-2">Uploaded by {uploaders[doc.uploaded_by] ?? "—"} · {fmtDateTime(doc.created_at)}</div>}
          {doc.status === "verified" && doc.verified_at && (
            <div className="col-span-2 text-present">Verified by {uploaders[doc.verified_by ?? ""] ?? "—"} · {fmtDateTime(doc.verified_at)}</div>
          )}
          {doc.status === "rejected" && doc.rejection_reason && (
            <div role="alert" className="col-span-2 text-absent">Rejected: {doc.rejection_reason}</div>
          )}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <UploadDialog guardId={guardId} slot={slot} replacing={hasFile} showNumberField={showNumberField} />
        {hasFile && (
          <Button type="button" variant="outline" size="xs" onClick={view} disabled={pending}>
            <Eye data-icon="inline-start" /> View
          </Button>
        )}
        {hasFile && doc?.status === "pending" && (
          <Button type="button" variant="outline" size="xs" onClick={verify} disabled={pending}>
            <Check data-icon="inline-start" /> Verify
          </Button>
        )}
        {hasFile && doc?.status !== "rejected" && (
          <RejectDialog guardId={guardId} documentId={doc!.id} slotLabel={slot.label} />
        )}
        {hasFile && (
          <DeleteConfirm onConfirm={del} pending={pending} label={slot.label} />
        )}
      </div>
    </div>
  );
}

function UploadDialog({
  guardId, slot, replacing, showNumberField,
}: {
  guardId: string;
  slot: (typeof DOCUMENT_TYPES)[number];
  replacing: boolean;
  showNumberField: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<UploadDocState, FormData>(uploadGuardDocument, undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && state?.error) toast.dismiss();
      }}
    >
      <DialogTrigger render={<Button type="button" variant={replacing ? "outline" : "default"} size="xs" />}>
        <Upload data-icon="inline-start" /> {replacing ? "Replace" : "Upload"}
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>{replacing ? "Replace" : "Upload"} {slot.label}</DialogTitle>
            <DialogDescription>JPEG, PNG, WebP or PDF, up to 10 MB.</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="guard_id" value={guardId} />
          <input type="hidden" name="type" value={slot.type} />
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`file-${slot.type}`}>File</Label>
              <Input id={`file-${slot.type}`} name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
            </div>
            {showNumberField && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`number-${slot.type}`}>{slot.type === "aadhaar" ? "Aadhaar number" : "PAN number"}</Label>
                <Input id={`number-${slot.type}`} name="number" placeholder={slot.type === "aadhaar" ? "12-digit number" : "ABCDE1234F"} />
                <p className="text-xs text-muted-foreground">Stored masked — never kept in full.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`issued-${slot.type}`}>Issued on</Label>
                <Input id={`issued-${slot.type}`} name="issued_on" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`expires-${slot.type}`}>Expires on</Label>
                <Input id={`expires-${slot.type}`} name="expires_on" type="date" />
              </div>
            </div>
            {state?.error && <p role="alert" className="text-sm text-absent">{state.error}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <SubmitAndClose pending={pending} error={state?.error} onClose={() => setOpen(false)} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Submits the form and closes the dialog once the action returns without an error. */
function SubmitAndClose({ pending, error, onClose }: { pending: boolean; error?: string; onClose: () => void }) {
  const prevPending = useRef(false);
  useEffect(() => {
    if (prevPending.current && !pending && !error) {
      onClose();
      toast.success("Document uploaded");
    }
    prevPending.current = pending;
  }, [pending, error, onClose]);
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Upload
    </Button>
  );
}

function RejectDialog({ guardId, documentId, slotLabel }: { guardId: string; documentId: string; slotLabel: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit() {
    startTransition(async () => {
      const res = await rejectGuardDocument(documentId, guardId, reason);
      if (res?.error) setError(res.error);
      else {
        setOpen(false);
        setReason("");
        toast.success(`${slotLabel} rejected`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="xs" />}>
        <X data-icon="inline-start" /> Reject
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {slotLabel}</DialogTitle>
          <DialogDescription>Explain what&apos;s wrong so the guard (or agency staff) can fix it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required />
          {error && <p role="alert" className="text-sm text-absent">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" disabled={pending || !reason.trim()} onClick={submit}>
            {pending && <Loader2 className="animate-spin" />}
            Reject document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirm({ onConfirm, pending, label }: { onConfirm: () => void; pending: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" size="xs" />}>
        <Trash2 data-icon="inline-start" /> Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {label}?</DialogTitle>
          <DialogDescription>This removes the file and its record. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
