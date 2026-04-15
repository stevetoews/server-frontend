import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/92 p-6 shadow-[0_22px_60px_-40px_rgba(0,0,0,0.65)] backdrop-blur",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
