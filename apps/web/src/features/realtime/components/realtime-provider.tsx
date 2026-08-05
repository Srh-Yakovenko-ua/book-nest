"use client";

import type { ReactNode } from "react";

import { useRealtimeConnection } from "../hooks/use-realtime-connection";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  useRealtimeConnection();

  return children;
}
