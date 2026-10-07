"use client";

import { useEffect, useState } from "react";
import { Pause, PhoneCall, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { PhoneFrame, type PhoneLine } from "@/components/campus/phone-frame";
import { render, TEMPLATES, type WaTemplate } from "@/lib/whatsapp/templates";
import { playLadder, RUNG_LABEL, type Rung, type RungState } from "@/lib/whatsapp/rules";
import { scenePhoto } from "@/lib/whatsapp/bot";
import { cn } from "cn";

/**
 * Plays one alert end to end on two phones — the guard's and the supervisor's — against the
 * escalation ladder. Drag the clock or press play; tap a reply on either phone to answer.
 */
type Scenario = {
  id: string;
  label: string;
  blurb: string;
  ladder: Rung[];
  values: Record<string, string[]>;
  image?: string;
  /** Sent regardless of replies, e.g. the photo report that follows an incident. */
  followUp?: { after_min: number; template_id: string };
  /** What the bot says back after a reply, per template. */
  ack: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "break", label: "Long break", blurb: "Ramesh has been on break 48 min at a 30-min post.",
    ladder: [{ after_min: 0, to: "guard", template_id: "t-break" }, { after_min: 5, to: "supervisor", template_id: "t-break-sup" }],
    values: { "t-break": ["Ramesh", "48", "30", "Gate 3"], "t-break-sup": ["Priya", "Ramesh Kumar", "53", "30", "Prestige Tech Park — Gate 3", "+91 99000 00001"] },
    ack: "Noted. The supervisor has been told you are back.",
  },
  {
    id: "missing", label: "Guard missing", blurb: "Gopal's phone went quiet 42 min ago, 160 m outside the fence.",
    ladder: [{ after_min: 0, to: "supervisor", template_id: "t-missing" }, { after_min: 3, to: "voice_call", template_id: null }, { after_min: 10, to: "owner", template_id: "t-missing" }],
    values: { "t-missing": ["Arun", "Gopal Reddy", "42", "Night", "Metro Cash & Carry, Yeshwanthpur", "160 m outside the fence, 01:12", "+91 99000 00012"] },
    ack: "Thanks — logged against the shift. The owner will not be paged.",
  },
  {
    id: "absent", label: "Absent roll-call", blurb: "15 min into the day shift, two guards have not checked in.",
    ladder: [{ after_min: 0, to: "supervisor", template_id: "t-absent" }, { after_min: 20, to: "site_lead", template_id: "t-absent" }, { after_min: 40, to: "owner", template_id: "t-absent" }],
    values: { "t-absent": ["Priya", "2", "Day", "Prestige Tech Park — Gate 3", "1) Ramesh Kumar · +91 99000 00001 | 2) Mohan Das · +91 99000 00003"] },
    ack: "Got it. Relief is marked as being arranged; the roster shows the gap until it is filled.",
  },
  {
    id: "incident", label: "Incident + photo report", blurb: "A guard logs a theft; 25 min later the photo report follows.",
    ladder: [{ after_min: 0, to: "supervisor", template_id: "t-incident" }, { after_min: 5, to: "site_lead", template_id: "t-incident" }, { after_min: 10, to: "owner", template_id: "t-incident" }],
    followUp: { after_min: 25, template_id: "t-report" },
    values: {
      "t-incident": ["Theft", "Metro Cash & Carry, Yeshwanthpur", "Copper cable missing from loading bay", "high", "Gopal Reddy", "02:14"],
      "t-report": ["Theft", "Metro Cash & Carry, Yeshwanthpur", "About 20 m of copper cable cut from the loading-bay panel; fence cut near Gate 3", "Area cordoned, police informed (FIR pending), client told", "3", "Gopal Reddy"],
    },
    image: scenePhoto("theft", "Theft · Metro Cash & Carry"),
    ack: "You own this incident now. Updates will come here.",
  },
];

const STATE_TONE: Record<RungState, "present" | "half-day" | "neutral" | "absent" | "olive"> = { answered: "present", waiting: "half-day", queued: "neutral", no_reply: "absent", skipped: "neutral" };
const STATE_LABEL: Record<RungState, string> = { answered: "Answered", waiting: "Waiting", queued: "Queued", no_reply: "No reply", skipped: "Not needed" };

function bubble(t: WaTemplate, values: string[], at: string, spent: boolean, image?: string): PhoneLine {
  return {
    id: `${t.id}-${at}`, from: "us", header: t.header_type === "image" ? null : t.header, image: t.header_type === "image" ? image ?? null : null,
    text: render(t.body, values), footer: t.footer, time: at, spent,
    buttons: t.buttons.map((b) => ({ kind: b.type === "quick_reply" ? "reply" : b.type === "url" ? "url" : "call", text: b.text })),
  };
}

export function BotSimulator() {
  const [sid, setSid] = useState(SCENARIOS[0]!.id);
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState<{ at: number; text: string; by: "guard" | "supervisor" } | null>(null);
  const [playing, setPlaying] = useState(false);
  const s = SCENARIOS.find((x) => x.id === sid)!;
  const end = Math.max(...s.ladder.map((r) => r.after_min), s.followUp?.after_min ?? 0) + 5;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setElapsed((e) => (e >= end ? (setPlaying(false), e) : e + 1)), 450);
    return () => clearInterval(t);
  }, [playing, end]);

  const states = playLadder(s.ladder, elapsed, answer?.at ?? null);
  const clock = (m: number) => { const base = 14 * 60 + 2 + m; return `${String(Math.floor(base / 60)).padStart(2, "0")}:${String(base % 60).padStart(2, "0")}`; };
  const tmpl = (id: string | null) => TEMPLATES.find((t) => t.id === id);

  const guardLines: PhoneLine[] = [];
  const supLines: PhoneLine[] = [];
  s.ladder.forEach((r, i) => {
    const st = states[i]!.state;
    if (st === "queued" || st === "skipped") return;
    const t = tmpl(r.template_id);
    if (r.to === "voice_call") {
      supLines.push({ id: `call-${i}`, from: "system", text: `📞 Automated call placed to the guard at ${clock(r.after_min)} — no answer` });
      return;
    }
    if (!t) return;
    const line = bubble(t, s.values[t.id] ?? t.samples, clock(r.after_min), !!answer, s.image);
    if (r.to === "guard") guardLines.push(line);
    else supLines.push(line);
  });
  if (answer) {
    const target = answer.by === "guard" ? guardLines : supLines;
    target.push({ id: "reply", from: "them", text: answer.text, time: clock(answer.at), read: true });
    target.push({ id: "ack", from: "us", text: s.ack, time: clock(answer.at) });
    if (answer.by === "guard" && supLines.length === 0) supLines.push({ id: "fyi", from: "system", text: "No escalation needed — the guard answered in time" });
  }
  if (s.followUp && elapsed >= s.followUp.after_min) {
    const t = tmpl(s.followUp.template_id)!;
    supLines.push({ ...bubble(t, s.values[t.id] ?? t.samples, clock(s.followUp.after_min), false, s.image), id: "follow-up" });
  }
  const guardInvolved = s.ladder.some((r) => r.to === "guard");

  function reset(next = sid) {
    setSid(next);
    setElapsed(0);
    setAnswer(null);
    setPlaying(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Scenario">
        {SCENARIOS.map((x) => <Button key={x.id} size="sm" variant={x.id === sid ? "default" : "outline"} aria-pressed={x.id === sid} onClick={() => reset(x.id)}>{x.label}</Button>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-sm">{s.blurb}</p>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Button size="icon" variant="outline" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause /> : <Play />}</Button>
            <Button size="icon" variant="ghost" aria-label="Reset" onClick={() => reset()}><RotateCcw /></Button>
            <input type="range" aria-label="Minutes since the event" value={elapsed} min={0} max={end} step={1} onChange={(e) => setElapsed(Number(e.target.value))} className="h-1 flex-1 cursor-pointer accent-[var(--primary)]" />
            <Mono className="w-24 text-right text-xs">+{elapsed} min · {clock(elapsed)}</Mono>
          </div>
          <ol className="flex flex-col gap-2" aria-label="Escalation ladder">
            {states.map(({ rung, state }, i) => (
              <li key={i} className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-opacity", (state === "queued" || state === "skipped") && "opacity-55")}>
                <Mono className="w-14 text-xs text-muted-foreground">+{rung.after_min} min</Mono>
                {rung.to === "voice_call" ? <PhoneCall className="size-4 text-muted-foreground" /> : <span className="size-2 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{RUNG_LABEL[rung.to]}</span>
                  <span className="text-muted-foreground"> · {rung.template_id ? tmpl(rung.template_id)?.name : "voice call, no WhatsApp"}</span>
                </div>
                <StatusPill tone={STATE_TONE[state]} size="xs" pulse={state === "waiting"}>{STATE_LABEL[state]}</StatusPill>
              </li>
            ))}
          </ol>
          {s.followUp && <p className="text-xs text-muted-foreground">+{s.followUp.after_min} min · the guard’s photo report goes to the supervisor whether or not anyone has answered.</p>}
          <p className="text-xs text-muted-foreground">The ladder stops at the first reply. Critical alerts ignore quiet hours; if WhatsApp cannot deliver, the same text goes by SMS.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-5">
          {guardInvolved && (
            <div className="flex flex-col items-center gap-2">
              <span className="eyebrow">Guard’s phone</span>
              <PhoneFrame title="GuardForce Alerts" lines={guardLines} label="Guard's WhatsApp" onReply={(text) => !answer && setAnswer({ at: elapsed, text, by: "guard" })} />
            </div>
          )}
          <div className="flex flex-col items-center gap-2">
            <span className="eyebrow">Supervisor’s phone</span>
            <PhoneFrame title="GuardForce Alerts" lines={supLines} label="Supervisor's WhatsApp" onReply={(text) => !answer && setAnswer({ at: elapsed, text, by: "supervisor" })} />
          </div>
        </div>
      </div>
    </div>
  );
}
