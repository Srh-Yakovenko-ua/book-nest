import type { KeyboardEvent } from "react";

const COMMAND_KEYS = {
  activate: "Enter",
  caret: new Set(["End", "Home"]),
  open: new Set(["ArrowDown", "ArrowUp"]),
} as const;

export function isPopupOpenKey(key: string): boolean {
  return COMMAND_KEYS.open.has(key);
}

export function keepCaretKeysInInput(event: KeyboardEvent<HTMLInputElement>) {
  if (COMMAND_KEYS.caret.has(event.key)) event.stopPropagation();
}

export function pressButtonOnEnter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== COMMAND_KEYS.activate || !(event.target instanceof HTMLButtonElement)) return;
  event.preventDefault();
  event.target.click();
}
