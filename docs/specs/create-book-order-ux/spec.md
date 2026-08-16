# Create BookOrder UX

Source: user request in the Codex conversation on 2026-08-14.

Scope: implement the first Order/Shipment management stage on the Delivery "In transit" page. Add a primary action that opens one sectioned form and creates a real `BookOrder` containing 1..N `BookOrderItem`s and 0..N shipments through the existing API.

The form contains order fields (store, optional order number, order date, currency, optional total, delivery cost, discount and note), a reusable library book picker with optional per-item prices, and optional shipment sections. Each shipment supports the backend fields exposed by the shared create-order contract and selects a non-empty subset of the order's books. A book may appear in at most one shipment; unassigned books remain clearly labelled as awaiting shipment.

On success the dialog closes and Delivery, Books and Series queries are invalidated without reloading the page. The existing single-book Delivery flow remains unchanged. Edit/manage, post-create item movement, drag-and-drop, statistics/sidebar redesign and unrelated integrations are excluded.

Required verification covers orders with one or multiple books, zero/one/two shipments, partially unassigned books, item prices, order totals, validation and API errors, cache invalidation, and responsive behavior. Run typecheck, lint, formatting checks and focused tests; use dev data if the environment permits live verification.
