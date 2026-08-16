# Create BookOrder manual total UX

Source: user request in the Codex conversation on 2026-08-16.

Scope: improve only the manual-total branch of the New Order dialog's Cost section. Present `totalAmount` as the final amount paid, move delivery and discount under optional breakdown copy, and show a compact summary without zero-value noise. Preserve manual `totalAmount` as source of truth and leave per-book mode, shared financial logic, API and domain unchanged.

Follow-up polish on 2026-08-16: clarify that the final amount already includes delivery and discount, reduce the breakdown hierarchy and spacing, visually bind the amount and currency controls, compact the summary, and hide native number steppers on the primary amount input using the project's existing classes.
