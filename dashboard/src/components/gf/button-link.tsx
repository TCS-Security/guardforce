import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Button>, "render" | "nativeButton"> & { href: string; prefetch?: boolean };

/** A shadcn Button rendered as a Next Link (correct semantics: no native <button>). */
export function ButtonLink({ href, prefetch, ...props }: Props) {
  return <Button {...props} nativeButton={false} render={<Link href={href} prefetch={prefetch} />} />;
}
