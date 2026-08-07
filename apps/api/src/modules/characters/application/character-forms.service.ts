import type {
  CharacterFormListView,
  CharacterFormView,
  CreateCharacterForm,
  Nullable,
  UpdateCharacterForm,
} from "@app/shared";

import { CHARACTER_FORM_ERROR_CODES, normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  CharacterFormRow,
  UpdateCharacterFormData,
} from "../infrastructure/character-forms.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import { emptyToNull } from "../domain/character-fields.js";
import { toCharacterFormView } from "../domain/character.mapper.js";
import { CharacterFormsRepository } from "../infrastructure/character-forms.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";

const log = createLogger("character-forms");

@Injectable()
export class CharacterFormsService {
  constructor(
    private readonly characterFormsRepository: CharacterFormsRepository,
    private readonly mediaService: MediaService,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async create({
    characterId,
    input,
    userId,
  }: {
    characterId: string;
    input: CreateCharacterForm;
    userId: string;
  }): Promise<CharacterFormView> {
    await this.assertCharacterOwned({ characterId, userId });
    await this.assertMediaOwned({ mediaId: input.portraitMediaId ?? null, userId });

    const created = await this.insertForm({
      characterId,
      description: emptyToNull(input.description),
      formType: input.formType,
      isSpoiler: input.isSpoiler,
      name: input.name,
      normalizedName: normalizeName(input.name),
      portraitMediaId: input.portraitMediaId ?? null,
      position: input.position ?? 0,
    });
    return this.toFormView(created);
  }

  async list({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<CharacterFormListView> {
    await this.assertCharacterOwned({ characterId, userId });
    const rows = await this.characterFormsRepository.listByCharacter({ characterId });
    return { forms: rows.map((row) => this.toFormView(row)) };
  }

  async remove({
    characterId,
    formId,
    userId,
  }: {
    characterId: string;
    formId: string;
    userId: string;
  }): Promise<void> {
    await this.assertCharacterOwned({ characterId, userId });
    const existing = await this.findOwnedForm({ characterId, formId });
    await this.characterFormsRepository.deleteById({ formId });
    await this.cleanupPortrait({ mediaId: existing.portraitMediaId, userId });
  }

  async update({
    characterId,
    formId,
    input,
    userId,
  }: {
    characterId: string;
    formId: string;
    input: UpdateCharacterForm;
    userId: string;
  }): Promise<CharacterFormView> {
    await this.assertCharacterOwned({ characterId, userId });
    const existing = await this.findOwnedForm({ characterId, formId });

    if (input.portraitMediaId !== undefined) {
      await this.assertMediaOwned({ mediaId: input.portraitMediaId ?? null, userId });
    }

    const updated = await this.applyUpdate({
      data: this.buildUpdateData(input),
      formId,
    });

    if (input.portraitMediaId !== undefined && input.portraitMediaId !== existing.portraitMediaId) {
      await this.cleanupPortrait({ mediaId: existing.portraitMediaId, userId });
    }
    return this.toFormView(updated);
  }

  private async applyUpdate({
    data,
    formId,
  }: {
    data: UpdateCharacterFormData;
    formId: string;
  }): Promise<CharacterFormRow> {
    try {
      return await this.characterFormsRepository.update({ data, formId });
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError("A form with this name already exists for this character", {
            code: CHARACTER_FORM_ERROR_CODES.duplicateName,
          }),
      });
    }
  }

  private assertCharacterOwned({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<void> {
    return this.accessAsserter.assertCharacterOwned({
      characterId,
      notFoundCode: CHARACTER_FORM_ERROR_CODES.characterNotFound,
      userId,
    });
  }

  private assertMediaOwned({
    mediaId,
    userId,
  }: {
    mediaId: Nullable<string>;
    userId: string;
  }): Promise<void> {
    return this.accessAsserter.assertMediaOwned({
      mediaId,
      notFoundCode: CHARACTER_FORM_ERROR_CODES.mediaOwnershipMismatch,
      userId,
    });
  }

  private buildUpdateData(input: UpdateCharacterForm): UpdateCharacterFormData {
    const data: UpdateCharacterFormData = {};
    if (input.name !== undefined) {
      data.name = input.name;
      data.normalizedName = normalizeName(input.name);
    }
    if (input.description !== undefined) {
      data.description = emptyToNull(input.description);
    }
    if (input.formType !== undefined) {
      data.formType = input.formType;
    }
    if (input.isSpoiler !== undefined) {
      data.isSpoiler = input.isSpoiler;
    }
    if (input.portraitMediaId !== undefined) {
      data.portraitMediaId = input.portraitMediaId ?? null;
    }
    if (input.position !== undefined) {
      data.position = input.position;
    }
    return data;
  }

  private async cleanupPortrait({
    mediaId,
    userId,
  }: {
    mediaId: Nullable<string>;
    userId: string;
  }): Promise<void> {
    if (mediaId === null) {
      return;
    }
    try {
      await this.mediaService.deleteIfUnreferenced({ id: mediaId, userId });
    } catch (error) {
      log.warn({ err: error, mediaId }, "failed to clean up orphaned character form portrait");
    }
  }

  private async findOwnedForm({
    characterId,
    formId,
  }: {
    characterId: string;
    formId: string;
  }): Promise<CharacterFormRow> {
    const form = await this.characterFormsRepository.findOwnedById({ characterId, formId });
    if (form === null) {
      throw new NotFoundError("Character form not found", {
        code: CHARACTER_FORM_ERROR_CODES.notFound,
      });
    }
    return form;
  }

  private async insertForm(data: {
    characterId: string;
    description: Nullable<string>;
    formType: string;
    isSpoiler: boolean;
    name: string;
    normalizedName: string;
    portraitMediaId: Nullable<string>;
    position: number;
  }): Promise<CharacterFormRow> {
    try {
      return await this.characterFormsRepository.create(data);
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError("A form with this name already exists for this character", {
            code: CHARACTER_FORM_ERROR_CODES.duplicateName,
          }),
      });
    }
  }

  private toFormView(row: CharacterFormRow): CharacterFormView {
    return toCharacterFormView({
      form: row,
      portrait: this.mediaService.buildViewOrNull(row.portraitMedia),
    });
  }
}
