# Delivery order card redesign

Source: user request in the Codex session on 2026-08-17.

Scope: refactor the order cards on `Deliveries → In transit` without changing backend logic, APIs, or existing data structures.

## Order header

- Left: store, `order number · date`, and order status below.
- Right: total amount as the primary value, book count below it, and the order actions menu.
- Remove the divider below the header.
- Make the total visually more prominent than the book count.

## Shipment section

- Do not render the shipment as a heavy nested card.
- Show `Shipment` with its status chip and the shipment actions menu on the right.
- Render delivery service, tracking number, and expected delivery as one compact metadata row separated by middle dots.
- Render the tracking link below the metadata row.
- Read-only metadata must not resemble form fields.

## Books

- Render books in two columns on desktop.
- Each book item contains a roughly 44–48 × 62–68 px cover, title, author, optional series/volume, price on the right, and no individual card border.
- Separate items only with light dividers.
- Preserve the `Show N more books` action when books exceed the visible limit.
- A single book must retain the two-column grid structure instead of stretching unnaturally.

## Menus

- The order menu is always visible.
- The shipment menu is always visible.
- On desktop, show the individual book menu only on hover or focus when it is needed, without removing its mobile affordance.

## Visual direction

- Preserve existing BookNest components, semantic styles, patterns, cream/beige surfaces, terracotta accents, soft blue status chips, serif title typography, rounded corners, and light borders/shadows.
- Prefer fewer nested borders, more space, clearer hierarchy, and stronger cover imagery.
- Reuse existing components before creating new ones.

## Non-goals

- Backend logic changes.
- API changes.
- Data structure changes.
- Changes to existing data.

## Follow-up: shipment section separation

- Give each shipment and all of its books one shared light cream/beige container with a thin semantic border and small radius.
- Do not add a strong shadow or make it a heavy nested card.
- Keep the shipment heading, status, actions, metadata, and tracking link inside this container.
- Render the existing book grid below the shipment header inside the same container.
- Use at most one thin divider between the shipment header and its books; do not give the header and book grid separate frames.
- Do not change the order header, book structure, API, or business logic.

## Follow-up: series row

- Match the series row used by book cards in My Library: series icon, series name, and a position label such as `1 з 6`.
