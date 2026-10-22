import type { Nullable } from "@app/shared";

const EDITOR_FOCUS = {
  fallback: "input:not([type='hidden']), textarea, button:not([disabled])",
  preferred: "[data-relationship-autofocus]:not([disabled])",
} as const;

export function focusFirstRelationshipControl(container: Nullable<HTMLElement>) {
  const target =
    findShownControl({ container, selector: EDITOR_FOCUS.preferred }) ??
    findShownControl({ container, selector: EDITOR_FOCUS.fallback });
  target?.focus();
}

function findShownControl({
  container,
  selector,
}: {
  container: Nullable<HTMLElement>;
  selector: string;
}): Nullable<HTMLElement> {
  if (container === null) return null;
  const controls = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return controls.find((control) => control.closest("[hidden]") === null) ?? null;
}
