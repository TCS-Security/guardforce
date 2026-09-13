"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/gf/section";
import { FormAlert } from "@/components/gf/form-alert";
import { changeOwnPassword, updateOwnProfile, type ActionState } from "../actions";

export function ProfileForms({ fullName, phone }: { fullName: string; phone: string | null }) {
  const [profileState, profileAction, profilePending] = useActionState<ActionState, FormData>(updateOwnProfile, undefined);
  const [pwState, pwAction, pwPending] = useActionState<ActionState, FormData>(changeOwnPassword, undefined);

  return (
    <div className="flex flex-col gap-4">
      <Section title="Your details" style={{ ["--i" as string]: 1 }}>
        <form action={profileAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" defaultValue={fullName} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={phone ?? ""} placeholder="9845012345" />
            </div>
          </div>
          {profileState?.error && <FormAlert>{profileState.error}</FormAlert>}
          {profileState?.ok && <FormAlert tone="success">Profile updated.</FormAlert>}
          <div><Button type="submit" disabled={profilePending}>{profilePending && <Loader2 className="animate-spin" />}Save</Button></div>
        </form>
      </Section>

      <Section title="Password" description="Sign-ins on other devices stay valid." style={{ ["--i" as string]: 2 }}>
        <form action={pwAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Repeat password</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            </div>
          </div>
          {pwState?.error && <FormAlert>{pwState.error}</FormAlert>}
          {pwState?.ok && <FormAlert tone="success">Password changed.</FormAlert>}
          <div><Button type="submit" variant="outline" disabled={pwPending}>{pwPending && <Loader2 className="animate-spin" />}Change password</Button></div>
        </form>
      </Section>
    </div>
  );
}
