import type { ClipboardEvent, KeyboardEvent } from "react";

const blockedNumberKeys = new Set(["+", "-", "E", "e"]);

export function blockNegativeNumberKeys(event: KeyboardEvent): void {
  if (blockedNumberKeys.has(event.key)) {
    event.preventDefault();
  }
}

export function blockNegativeNumberPaste(event: ClipboardEvent): void {
  if (event.clipboardData.getData("text").includes("-")) {
    event.preventDefault();
  }
}
