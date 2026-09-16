"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The strip every filter row sits on. A *tinted tray*, not another white card: the
 * controls on it are the lightest thing in the strip, which is what makes them read
 * as controls from across the room. A white bar full of near-white selects is what
 * the founder was looking straight past.
 *
 * The descendant overrides below are deliberate. `Select`/`Input` are tinted by
 * default because they usually sit on a white card; inside the tray that would
 * camouflage them, so they flip to `bg-card` here. Hover is restated rather than
 * inherited, because the parent's descendant selector and the child's own
 * `hover:` utility carry the same specificity and source order decides the winner.
 *
 * Exported as a class too, so a `<form method="get">` filter row (leave history)
 * gets the same surface without an extra wrapper element.
 */
export const filterBarClass = [
  "flex flex-wrap items-end gap-x-3 gap-y-2.5 rounded-xl border border-border bg-secondary px-3 py-2.5",
  "[&_[data-slot=select-trigger]]:h-9 [&_[data-slot=select-trigger]]:bg-card [&_[data-slot=select-trigger]]:shadow-sm",
  "[&_[data-slot=select-trigger]:hover]:bg-accent",
  "[&_[data-slot=input]]:h-9 [&_[data-slot=input]]:bg-card [&_[data-slot=input]]:shadow-sm",
  "[&_[data-slot=day-stepper]]:bg-card [&_[data-slot=day-stepper]]:shadow-sm",
  // Apply/Reset and the stepper arrows line up with the taller controls.
  "[&_[data-slot=button]]:h-9",
].join(" ");

export function FilterBar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div data-slot="filter-bar" className={cn("reveal", filterBarClass, className)} {...props} />;
}

/** A labelled slot inside the bar: mono eyebrow above the control. */
export function FilterField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Not `.eyebrow`: on the tray the label needs to be readable, not a whisper. */}
      <Label htmlFor={htmlFor} className="font-mono text-[11px] font-medium tracking-[0.14em] text-foreground/70 uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Search box with the magnifier tucked inside. Width comes from `className`. */
export function FilterSearch({
  className,
  inputClassName,
  ...props
}: React.ComponentProps<"input"> & { inputClassName?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className={cn("h-9 pl-8", inputClassName)} />
    </div>
  );
}

/**
 * Prev / date / next as one segmented instrument. `onChange` gets an ISO date
 * (`yyyy-mm-dd`) whichever way the day was picked.
 */
export function DayStepper({
  id,
  value,
  onChange,
  className,
  prevLabel = "Previous day",
  nextLabel = "Next day",
}: {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  function shift(days: number) {
    const d = new Date(`${value}T12:00:00`);
    d.setDate(d.getDate() + days);
    onChange(d.toISOString().slice(0, 10));
  }

  return (
    <div
      data-slot="day-stepper"
      className={cn(
        "flex h-9 items-center overflow-hidden rounded-lg border border-input bg-card shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={prevLabel}
        onClick={() => shift(-1)}
        className="size-9 shrink-0 rounded-none bg-secondary hover:bg-accent"
      >
        <ChevronLeft />
      </Button>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-9 w-[132px] rounded-none border-x border-y-0 border-input bg-card px-2 font-mono text-xs shadow-none focus-visible:ring-0 md:text-xs"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={nextLabel}
        onClick={() => shift(1)}
        className="size-9 shrink-0 rounded-none bg-secondary hover:bg-accent"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
