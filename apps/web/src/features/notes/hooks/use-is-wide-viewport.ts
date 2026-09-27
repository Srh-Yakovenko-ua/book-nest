"use client";

import { useSyncExternalStore } from "react";

import { VIEWPORT_QUERIES } from "@/lib/viewport";

export function useIsWideViewport(): boolean {
  return useSyncExternalStore(subscribeToViewport, readIsWide, readIsWideOnServer);
}

function readIsWide(): boolean {
  return window.matchMedia(VIEWPORT_QUERIES.beyondMobile).matches;
}

function readIsWideOnServer(): boolean {
  return false;
}

function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(VIEWPORT_QUERIES.beyondMobile);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
