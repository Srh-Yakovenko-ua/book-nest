"use client";

import { useSyncExternalStore } from "react";

import { VIEWPORT_QUERIES } from "@/lib/viewport";

export function useIsShortViewport(): boolean {
  return useSyncExternalStore(subscribeToViewport, readIsShort, readIsShortOnServer);
}

function readIsShort(): boolean {
  return window.matchMedia(VIEWPORT_QUERIES.shortScreen).matches;
}

function readIsShortOnServer(): boolean {
  return false;
}

function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(VIEWPORT_QUERIES.shortScreen);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
