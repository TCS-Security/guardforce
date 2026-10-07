"use client";

import { useEffect, useRef } from "react";
import { BadgeCheck, ChevronLeft, CornerUpLeft, ExternalLink, MoreVertical, Paperclip, Phone, Smile, Video } from "lucide-react";
import { cn } from "cn";

/**
 * A phone showing a WhatsApp chat from the recipient's side: our business messages arrive on
 * the left, their replies go out on the right. Quick-reply buttons are live when `onReply` is
 * given, which is how a demo "plays the guard" (or the host) without a second device.
 *
 * Colours here imitate WhatsApp's own chrome, so they are the one place in the app that does
 * not use our status tokens.
 */
const WA = {
  bar: "#075e54",
  barDark: "#1f2c34",
  chat: "#efeae2",
  incoming: "#ffffff",
  outgoing: "#d9fdd3",
  link: "#027eb5",
  tick: "#53bdeb",
  meta: "#667781",
};

export type PhoneLine = {
  id: string;
  from: "us" | "them" | "system";
  text: string;
  time?: string;
  header?: string | null;
  footer?: string | null;
  buttons?: { kind: "reply" | "url" | "call"; text: string }[];
  read?: boolean;
  /** Buttons stop being tappable once the conversation has moved on. */
  spent?: boolean;
  image?: string | null;
};

export function PhoneFrame({
  title,
  subtitle = "Business account",
  lines,
  onReply,
  typing,
  className,
  label,
  avatar,
}: {
  title: string;
  subtitle?: string;
  lines: PhoneLine[];
  onReply?: (text: string, lineId: string) => void;
  typing?: boolean;
  className?: string;
  label?: string;
  avatar?: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines.length, typing]);

  return (
    <figure
      aria-label={label ?? `WhatsApp chat with ${title}`}
      className={cn("relative mx-auto w-[300px] shrink-0 rounded-[38px] border-[10px] border-ink bg-ink p-0 shadow-[0_24px_60px_-20px_oklch(0_0_0/0.45)] dark:border-neutral-800 dark:bg-neutral-800", className)}
    >
      <div className="absolute top-1.5 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink dark:bg-neutral-800" aria-hidden />
      <div className="flex h-[560px] flex-col overflow-hidden rounded-[28px]" style={{ background: WA.chat }}>
        <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[10px] font-semibold text-white" style={{ background: WA.bar }} aria-hidden>
          <span className="font-mono">9:41</span>
          <span className="font-mono">5G ▮▮▮ 82%</span>
        </div>
        <header className="flex items-center gap-2 px-2 pb-2 text-white" style={{ background: WA.bar }}>
          <ChevronLeft className="size-5 opacity-90" aria-hidden />
          {avatar ?? (
            <span className="flex size-8 items-center justify-center rounded-full bg-white/90 font-display text-xs font-bold" style={{ color: WA.bar }}>
              GF
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1 truncate text-[13px] font-semibold">
              {title}
              <BadgeCheck className="size-3.5 shrink-0 fill-[#25d366] text-white" aria-label="Verified business" />
            </div>
            <div className="truncate text-[10.5px] opacity-80">{typing ? "typing…" : subtitle}</div>
          </div>
          <Video className="size-4 opacity-90" aria-hidden />
          <Phone className="size-4 opacity-90" aria-hidden />
          <MoreVertical className="size-4 opacity-90" aria-hidden />
        </header>

        <div ref={scroller} className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 py-3 text-[12.5px] leading-snug text-[#111b21]" role="log" aria-live="polite">
          <div className="mx-auto mb-1 rounded-md bg-[#fff5c4] px-2 py-1 text-center text-[10px] text-[#54656f]">
            Messages are from a verified business. Tap a button to reply.
          </div>
          {lines.map((l) => {
            if (l.from === "system") {
              return (
                <div key={l.id} className="mx-auto my-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-[#54656f] shadow-sm">
                  {l.text}
                </div>
              );
            }
            const mine = l.from === "them";
            return (
              <div key={l.id} className={cn("flex max-w-[86%] flex-col gap-[3px]", mine ? "self-end" : "self-start")}>
                <div
                  className={cn("relative rounded-lg px-2 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]", mine ? "rounded-tr-none" : "rounded-tl-none")}
                  style={{ background: mine ? WA.outgoing : WA.incoming }}
                >
                  {l.image && <img src={l.image} alt="" className="mb-1 aspect-[4/3] w-full rounded-md object-cover" />}
                  {l.header && <div className="mb-0.5 font-semibold">{l.header}</div>}
                  <div className="whitespace-pre-line">{l.text}</div>
                  {l.footer && <div className="mt-1 text-[10.5px]" style={{ color: WA.meta }}>{l.footer}</div>}
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px]" style={{ color: WA.meta }}>
                    {l.time}
                    {mine && <span style={{ color: l.read ? WA.tick : WA.meta }} aria-label={l.read ? "Read" : "Delivered"}>✓✓</span>}
                  </div>
                </div>
                {!mine && l.buttons?.map((b) => {
                  const live = b.kind === "reply" && onReply && !l.spent;
                  const Icon = b.kind === "url" ? ExternalLink : b.kind === "call" ? Phone : CornerUpLeft;
                  return (
                    <button
                      key={b.text}
                      type="button"
                      disabled={!live}
                      onClick={() => live && onReply!(b.text, l.id)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12.5px] font-medium shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition",
                        live ? "hover:brightness-95 active:scale-[0.98]" : "cursor-default opacity-70",
                      )}
                      style={{ background: WA.incoming, color: WA.link }}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {b.text}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {typing && (
            <div className="self-start rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm" aria-label="Typing">
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-2 pb-3 pt-1" aria-hidden>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] text-[#8696a0]">
            <Smile className="size-4" /> Message <Paperclip className="ml-auto size-4" />
          </div>
          <span className="flex size-9 items-center justify-center rounded-full text-white" style={{ background: "#00a884" }}>
            <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>
          </span>
        </div>
      </div>
    </figure>
  );
}
