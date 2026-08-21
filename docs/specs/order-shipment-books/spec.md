# Order → Shipment → Books

Source: user-provided specification in the Codex conversation on 2026-08-16.

Scope: redesign the order card on the “Books in transit” page using existing frontend patterns, without backend, API, or domain-logic changes.

## Order header

- Show the store.
- Show the order number and date.
- Show `N books · total` on the right.
- Show the order status badge.
- Keep only order-level actions in the order menu:
  - Edit order.
  - Add book.
  - Add shipment.
  - Cancel order.

## Shipment block

- Render each shipment as a separate compact block.
- Show `Shipment` or `Shipment 1`.
- Show the status badge.
- Show the delivery service.
- Show the tracking number.
- Show the expected date.
- Provide an “Open tracking” action.
- Provide a “Mark shipment as received” CTA.
- Keep only shipment-level actions in the shipment menu.
- Do not mix shipment actions with book actions.

## Books

- Replace separate large book cards with a compact list in one container.
- Each row shows cover, title, author, series when present, price, and a book/item menu.
- Separate rows with dividers rather than individual bordered cards.
- Keep only these book menu actions:
  - Open book.
  - Change price.
  - Move to another shipment when applicable.
  - Cancel this book.

## Large orders

- Show the first three books by default.
- When more books exist, show “Show N more books”.
- When expanded, show “Collapse”.
- Hide checkboxes by default.
- Show checkboxes only after the “Select” action.

## Order list grid

- Desktop uses a two-column order-card grid.
- Tablet and mobile use one column.
- Cards in a row use consistent spacing without forcing equal heights.

## Reuse-first

- Reuse existing cards, badges, menus, buttons, book rows, responsive grid, spacing tokens, typography, and existing Order/Shipment actions.
- Do not introduce new UI patterns unless necessary.
- Do not change backend, API, or domain logic.

## Verification

- Verify desktop, tablet, and mobile layouts.
- Run typecheck and lint.
