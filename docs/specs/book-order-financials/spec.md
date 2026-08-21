# BookOrder financial consistency

Source: user request in the 2026-08-14 Codex session.

Scope: make `BookOrderItem.price`, `BookOrder.deliveryPrice`, `BookOrder.discount`, and `BookOrder.totalAmount` financially consistent across create, update, read models, cards, history, statistics, and the New Order form.

When every item price is known, the final total is derived as item subtotal plus delivery minus discount. Missing delivery and discount are zero. A negative result is invalid. When any item price is unknown, a manual total is allowed and absence of that total remains unknown. Backend writes are authoritative and recalculate derived totals transactionally. All consumers use the normalized financial result rather than independent fallback formulas.

The New Order form shows a live calculated breakdown for complete item prices and a manual total with a priced-items counter for incomplete prices. The UI name is “Сума замовлення”.
