import type { NotificationEntityState, NotificationEntityType, Nullable } from "@app/shared";

import { NotificationEntityTypeSchema } from "@app/shared";

export const BOOK_ENTITY_TYPE = "book" as const satisfies NotificationEntityType;

export type EntityDeletionLookup = ReadonlyMap<string, Nullable<Date>>;

export type NotificationEntityRef = {
  entityId: Nullable<string>;
  entityType: Nullable<string>;
};

type ResolveEntityState = (input: {
  deletionLookup: EntityDeletionLookup;
  entityId: string;
}) => NotificationEntityState;

export function collectBookEntityIds(refs: readonly NotificationEntityRef[]): string[] {
  const bookIds = new Set<string>();
  for (const ref of refs) {
    if (ref.entityType === BOOK_ENTITY_TYPE && ref.entityId !== null) {
      bookIds.add(ref.entityId);
    }
  }
  return [...bookIds];
}

export function resolveNotificationEntityState({
  deletionLookup,
  ref,
}: {
  deletionLookup: EntityDeletionLookup;
  ref: NotificationEntityRef;
}): Nullable<NotificationEntityState> {
  const entityType = NotificationEntityTypeSchema.safeParse(ref.entityType);
  if (!entityType.success || ref.entityId === null) {
    return null;
  }

  return RESOLVE_STATE_BY_ENTITY_TYPE[entityType.data]({
    deletionLookup,
    entityId: ref.entityId,
  });
}

function resolveFromBookDeletionLookup({
  deletionLookup,
  entityId,
}: {
  deletionLookup: EntityDeletionLookup;
  entityId: string;
}): NotificationEntityState {
  const deletedAt = deletionLookup.get(entityId);
  if (deletedAt === undefined) {
    return "gone";
  }
  return deletedAt === null ? "live" : "trashed";
}

const RESOLVE_STATE_BY_ENTITY_TYPE = {
  [BOOK_ENTITY_TYPE]: resolveFromBookDeletionLookup,
} as const satisfies Record<NotificationEntityType, ResolveEntityState>;
