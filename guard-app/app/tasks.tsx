import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { refreshHome, time, useStore } from "@/data/store";
import type { TaskInfo } from "@/api/types";
import { useT } from "@/i18n";
import { Body, Card, EmptyState, Mono, Pill, Screen, Title } from "@/ui/components";

export function useEffectiveTasks(): TaskInfo[] {
  const home = useStore((s) => s.home); const ov = useStore((s) => s.taskOverrides);
  return (home?.tasks ?? []).map((x) => { const o = ov.find((y) => y.id === x.id); return o ? { ...x, status: o.status } : x; }).filter((x) => x.status !== "done");
}

export default function TasksScreen() {
  const t = useT(); const router = useRouter(); const tt = time();
  const tasks = useEffectiveTasks();
  useEffect(() => { void refreshHome(); }, []);
  return (
    <Screen eyebrow={t("tasks_eyebrow")} title={t("tasks_title")} onBack={() => router.back()}>
      {!tasks.length ? <EmptyState text={t("tasks_empty")} /> : null}
      {tasks.map((task) => (
        <Card key={task.id} onPress={() => router.push(`/task/${task.id}` as never)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><Title>{task.title}</Title></View>{task.status === "in_progress" ? <Pill text={t("patrol_status_in_progress")} tone="olive" /> : null}</View>
          <View style={{ marginTop: 4 }}><Mono>{task.due_at ? t("task_due", tt.clock(task.due_at)) : t("task_no_due")}</Mono></View>
          {task.photo_required ? <Body muted size={13} style={{ marginTop: 4 }}>{t("task_photo_required")}</Body> : null}
        </Card>
      ))}
    </Screen>
  );
}
