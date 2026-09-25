import type { Nullable } from "@app/shared";

export function focusOnMount(element: Nullable<HTMLElement>) {
  element?.focus();
}
