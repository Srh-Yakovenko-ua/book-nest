import type { Nullable } from "@app/shared";

export function restoreFocusTo(event: Event, target: Nullable<HTMLElement>): void {
  if (target === null || !target.isConnected) return;
  event.preventDefault();
  target.focus();
}

export function restoreLoanContactTriggerFocus(event: Event, loanId: string): void {
  restoreFocusTo(
    event,
    document.querySelector<HTMLElement>(`[data-loan-contact-trigger="${loanId}"]`),
  );
}

export function restoreLoanTriggerFocus(event: Event, loanId: string): void {
  restoreFocusTo(event, document.querySelector<HTMLElement>(`[data-loan-trigger="${loanId}"]`));
}
