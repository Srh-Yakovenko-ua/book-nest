export function restoreLoanTriggerFocus(event: Event, loanId: string): void {
  const trigger = document.querySelector<HTMLElement>(`[data-loan-trigger="${loanId}"]`);
  if (trigger === null) return;
  event.preventDefault();
  trigger.focus();
}
