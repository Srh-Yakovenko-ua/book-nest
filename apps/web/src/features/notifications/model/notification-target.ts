import type { NotificationEntityState, NotificationPayload, Nullable } from "@app/shared";

export type NotificationTarget =
  { href: string; kind: "book" } | { kind: "none" } | { kind: "trashed" };

export function resolveNotificationTarget({
  entityState,
  payload,
}: {
  entityState: Nullable<NotificationEntityState>;
  payload: NotificationPayload;
}): NotificationTarget {
  const bookId = "bookId" in payload ? payload.bookId : null;
  if (entityState === null || bookId === null) return { kind: "none" };

  switch (entityState) {
    case "gone":
      return { kind: "none" };
    case "live":
      return { href: `/books/${bookId}`, kind: "book" };
    case "trashed":
      return { kind: "trashed" };
    default:
      return assertNever(entityState);
  }
}

function assertNever(value: never): never {
  throw new Error(`unhandled notification entity state: ${JSON.stringify(value)}`);
}
