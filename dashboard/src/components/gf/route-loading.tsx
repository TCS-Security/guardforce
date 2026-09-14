import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";

type Variant = "table" | "tiles" | "detail" | "calendar" | "form" | "map";

/**
 * Instant route shells, rendered by loading.tsx while the route's server
 * components stream in. One shared component keeps the pulse rhythm and
 * spacing consistent; each route picks the variant closest to its layout.
 */
export function RouteLoading({ variant, bare = false, className }: { variant: Variant; bare?: boolean; className?: string }) {
  if (variant === "map") return <MapSkeleton />;
  // bare: the parent layout already renders the page header (e.g. settings children).
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-6", className ?? (bare ? undefined : "max-w-[1400px]"))}>
      {!bare && <HeaderSkeleton />}
      {variant === "table" && <TableSkeleton />}
      {variant === "tiles" && <TilesSkeleton />}
      {variant === "detail" && <DetailSkeleton />}
      {variant === "calendar" && <CalendarSkeleton />}
      {variant === "form" && <FormSkeleton />}
    </div>
  );
}

/** Mirrors PageHeader: eyebrow, display title, description, action. */
function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-1 h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

/** Filter bar over a list of avatar rows — index pages (events, tasks, sites…). */
function TableSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-3"><Skeleton className="h-6 w-64" /></div>
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stat tiles over two sections — overview and reports. */
function TilesSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card">
          <div className="border-b p-3"><Skeleton className="h-5 w-40" /></div>
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        </div>
      ))}
    </>
  );
}

/** Identity header over stacked cards — record detail pages. */
function DetailSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </>
  );
}

/** Seven-column month grid — leave calendar and roster board. */
function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={`h-${i}`} className="h-4 w-full" />
      ))}
      {Array.from({ length: 35 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

/** Two cards of labelled fields — settings and report forms. */
function FormSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** Full-bleed block for the live map page. */
function MapSkeleton() {
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <Skeleton className="h-[70vh] min-h-[420px] w-full rounded-none" />
    </div>
  );
}
