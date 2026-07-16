export function restoreDedicationTriggerFocus(event: Event, bookId: string): void {
  const trigger = document.querySelector<HTMLElement>(`[data-dedication-trigger="${bookId}"]`);
  if (trigger === null) return;
  event.preventDefault();
  trigger.focus();
}
