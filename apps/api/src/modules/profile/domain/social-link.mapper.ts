import { type SocialLinkView, SocialPlatformSchema } from "@app/shared";

import type { UserSocialLinkModel } from "../../../generated/prisma/models.js";

export function toSocialLinkView(link: UserSocialLinkModel): SocialLinkView {
  return {
    createdAt: link.createdAt.toISOString(),
    id: link.id,
    label: link.label,
    platform: SocialPlatformSchema.parse(link.platform),
    updatedAt: link.updatedAt.toISOString(),
    url: link.url,
    username: link.username,
  };
}
