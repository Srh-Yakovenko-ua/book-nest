import type { PublisherView } from "@app/shared";

import type { PublisherModel } from "../../../generated/prisma/models.js";

export function toPublisherView(publisher: PublisherModel): PublisherView {
  return {
    id: publisher.id,
    isCustom: publisher.userId !== null,
    name: publisher.name,
  };
}
