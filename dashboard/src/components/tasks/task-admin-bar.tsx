"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteTask, setTaskStatus } from "@/app/(app)/tasks/actions";
import type { TaskStatus } from "@/lib/supabase/types";

/** Manager controls: close out a task or remove one created by mistake. */
export function TaskAdminBar({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      {status !== "done" && (
        <form action={setTaskStatus}>
          <input type="hidden" name="task_id" value={taskId} />
          <input type="hidden" name="status" value="done" />
          <Button type="submit" variant="outline" size="sm">Mark done</Button>
        </form>
      )}
      {status !== "missed" && (
        <form action={setTaskStatus}>
          <input type="hidden" name="task_id" value={taskId} />
          <input type="hidden" name="status" value="missed" />
          <Button type="submit" variant="outline" size="sm">Mark missed</Button>
        </form>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Delete task" onClick={() => setConfirming(true)}>
        <Trash2 />
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>It disappears from the guards' app and from reports. Completed evidence is lost.</DialogDescription>
          </DialogHeader>
          <form action={deleteTask} className="contents">
            <input type="hidden" name="task_id" value={taskId} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button type="submit" variant="destructive">Delete task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
