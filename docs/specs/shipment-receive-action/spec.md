# Shipment receive action

Source: user-provided task in the conversation on 2026-08-17.

Scope: refactor the receive action in order cards on the “Книги в дорозі” page without backend or domain-logic changes.

## Requirements

1. Remove the persistent full-width “Позначити N книг отриманими” CTA from the bottom of each shipment/card.
2. Add “Позначити посилку отриманою” to the concrete Shipment `⋯` menu and reuse the existing shipment receive flow.
3. Do not place shipment receive in Order or Book menus.
4. For `ready_for_pickup`, additionally render a compact visible “Позначити отриманою” CTA in the Shipment header/summary.
5. For other statuses, expose receive only through the Shipment menu.
6. Shipment menus contain only real, status-allowed shipment actions. Do not create fake actions or frontend transition logic.
7. Preserve an existing item-level partial receive action only if already supported; do not duplicate it.
8. Reuse existing dropdowns, status/actions, mutations, confirmation dialog, button variants, invalidation, and API/domain transitions.
9. Do not change backend or business logic when the current Shipment receive API covers the scenario.

## Verification

- The large full-width receive CTA is absent.
- Shipment receive is available from the Shipment menu.
- A compact receive CTA is visible for `ready_for_pickup`.
- Order, Shipment, and Book actions remain separated.
- Verify desktop and mobile.
- Run typecheck, lint, formatting check, and relevant focused tests.
