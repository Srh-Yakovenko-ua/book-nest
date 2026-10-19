"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const RelationshipGraphCanvasLazy = dynamic(
  () =>
    import("./relationship-graph-canvas").then(
      (canvasModule) => canvasModule.RelationshipGraphCanvas,
    ),
  { loading: () => <Skeleton className="size-full rounded-none" />, ssr: false },
);
