export const SOFT_DELETE_SCOPE = {
  active: { deletedAt: null },
  trashed: { deletedAt: { not: null } },
} as const;
