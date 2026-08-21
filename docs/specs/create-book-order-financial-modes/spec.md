# Create BookOrder financial modes UX

Source: user request in the Codex conversation on 2026-08-16.

Scope: restructure the existing New Order dialog into Order, Books, Cost and Delivery sections. Add mutually exclusive manual-total and per-book price entry modes while preserving the existing BookOrder domain, shared financial resolver, API, book picker, shipment behavior, dialog shell and cache invalidation.

Manual-total mode sends no item prices and treats `totalAmount` as the known final order amount. Per-book mode sends no manual total, requires a price for every selected book, and presents the total calculated by the shared resolver from item prices, delivery and discount. Switching modes clears values belonging exclusively to the hidden mode.
