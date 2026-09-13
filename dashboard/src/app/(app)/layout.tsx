import { requireSession } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  return <AppShell session={session}>{children}</AppShell>;
}
