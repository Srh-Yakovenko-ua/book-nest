"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const GraphWorkspaceCanvasLazy = dynamic(
  () =>
    import("./graph-workspace-canvas").then((canvasModule) => canvasModule.GraphWorkspaceCanvas),
  { loading: () => <Skeleton className="size-full rounded-2xl" />, ssr: false },
);
