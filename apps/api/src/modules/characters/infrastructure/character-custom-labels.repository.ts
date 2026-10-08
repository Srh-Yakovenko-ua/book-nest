import { BookCharacterRoleTypeSchema, BookCharacterStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

export type CustomLabelUsage = {
  roles: CustomLabelUsageRow[];
  statuses: CustomLabelUsageRow[];
};

export type CustomLabelUsageRow = {
  count: number;
  label: string;
};

@Injectable()
export class CharacterCustomLabelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCustomLabelUsage({ userId }: { userId: string }): Promise<CustomLabelUsage> {
    const appearanceScope = spoilerSafeAppearanceScope(userId);

    const [roleGroups, statusGroups] = await Promise.all([
      this.prisma.bookCharacterRole.groupBy({
        _count: { _all: true },
        by: ["customRole"],
        where: {
          bookCharacter: appearanceScope,
          customRole: { not: null },
          isSpoiler: false,
          roleType: BookCharacterRoleTypeSchema.enum.custom,
        },
      }),
      this.prisma.bookCharacter.groupBy({
        _count: { _all: true },
        by: ["statusCustomText"],
        where: {
          ...appearanceScope,
          status: BookCharacterStatusSchema.enum.other,
          statusCustomText: { not: null },
          statusIsSpoiler: false,
        },
      }),
    ]);

    return {
      roles: roleGroups.flatMap((group) =>
        toUsageRow({ count: group._count._all, label: group.customRole }),
      ),
      statuses: statusGroups.flatMap((group) =>
        toUsageRow({ count: group._count._all, label: group.statusCustomText }),
      ),
    };
  }
}

function spoilerSafeAppearanceScope(userId: string): Prisma.BookCharacterWhereInput {
  return {
    book: SOFT_DELETE_SCOPE.active,
    character: { ...SOFT_DELETE_SCOPE.active, hideProfileAsSpoiler: false, userId },
    hidePresenceAsSpoiler: false,
  };
}

function toUsageRow({
  count,
  label,
}: {
  count: number;
  label: null | string;
}): CustomLabelUsageRow[] {
  return label === null ? [] : [{ count, label }];
}
