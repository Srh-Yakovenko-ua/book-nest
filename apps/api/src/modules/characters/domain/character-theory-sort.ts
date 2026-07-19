import type { CharacterTheorySort } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

export const THEORY_LIST_ORDER_BY: Record<
  CharacterTheorySort,
  Prisma.CharacterTheoryOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  recently_updated: [{ updatedAt: "desc" }],
  status: [{ status: "asc" }, { createdAt: "desc" }],
};
