"use client";

import type { Nullable } from "@app/shared";

import { useSyncExternalStore } from "react";

const DESKTOP_MIN_WIDTH = 1024;

export function useMobileViewport(): Nullable<boolean> {
  return useSyncExternalStore(subscribeToMobileViewport, isMobileViewport, () => null);
}

function isMobileViewport(): boolean {
  return window.innerWidth < DESKTOP_MIN_WIDTH;
}

function subscribeToMobileViewport(onChange: () => void) {
  const query = window.matchMedia(`(max-width: ${DESKTOP_MIN_WIDTH - 1}px)`);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
