"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The raised strip every filter row sits on. Exported as a class too, so a
 * `<form method="get">` filter row (leave history) gets the same surface without
 * an extra wrapper element.
 */
export const filterBarClass =
  "flex flex-wrap items-end gap-x-3 gap-y-2.5 rounded-lg border border-border bg-card p-2.5 shadow-sm";

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
      <Label htmlFor={htmlFor} className="eyebrow">{label}</Label>
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
      <Input {...props} className={cn("h-8 pl-8", inputClassName)} />
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
        "flex h-8 items-center overflow-hidden rounded-lg border border-input bg-secondary shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={prevLabel}
        onClick={() => shift(-1)}
        className="size-8 shrink-0 rounded-none hover:bg-accent"
      >
        <ChevronLeft />
      </Button>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-8 w-[132px] rounded-none border-x border-y-0 border-input bg-card px-2 font-mono text-xs shadow-none focus-visible:ring-0 md:text-xs"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={nextLabel}
        onClick={() => shift(1)}
        className="size-8 shrink-0 rounded-none hover:bg-accent"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
