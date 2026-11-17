import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type RefreshingRegionProps = ComponentProps<"div"> & { isRefreshing: boolean };

export function RefreshingRegion({ className, isRefreshing, ...props }: RefreshingRegionProps) {
  return (
    <div
      aria-busy={isRefreshing}
      className={cn(
        "transition-opacity duration-200 motion-reduce:transition-none",
        isRefreshing && "opacity-60",
        className,
      )}
      inert={isRefreshing}
      {...props}
    />
  );
}
