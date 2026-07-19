import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const formInclude = { portraitMedia: true } satisfies Prisma.CharacterFormInclude;

export type CharacterFormRow = Prisma.CharacterFormGetPayload<{ include: typeof formInclude }>;

export type CreateCharacterFormData = {
  characterId: string;
  description: Nullable<string>;
  formType: string;
  isSpoiler: boolean;
  name: string;
  normalizedName: string;
  portraitMediaId: Nullable<string>;
  position: number;
};

export type UpdateCharacterFormData = {
  description?: Nullable<string>;
  formType?: string;
  isSpoiler?: boolean;
  name?: string;
  normalizedName?: string;
  portraitMediaId?: Nullable<string>;
  position?: number;
};

@Injectable()
export class CharacterFormsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: CreateCharacterFormData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterFormRow> {
    return client.characterForm.create({ data, include: formInclude });
  }

  async deleteById(
    { formId }: { formId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.characterForm.delete({ where: { id: formId } });
  }

  findOwnedById(
    { characterId, formId }: { characterId: string; formId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterFormRow>> {
    return client.characterForm.findFirst({
      include: formInclude,
      where: { characterId, id: formId },
    });
  }

  listByCharacter(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterFormRow[]> {
    return client.characterForm.findMany({
      include: formInclude,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      where: { characterId },
    });
  }

  update(
    { data, formId }: { data: UpdateCharacterFormData; formId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterFormRow> {
    return client.characterForm.update({ data, include: formInclude, where: { id: formId } });
  }
}
