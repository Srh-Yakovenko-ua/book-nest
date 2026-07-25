import type {
  BookCharacterView,
  CharacterDetailsView,
  CharacterFormView,
  CharacterGlobalSummaryView,
  CharacterRevealFieldKey,
  CharacterSummaryView,
  MediaView,
  Nullable,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type {
  CharacterDetailsRow,
  CharacterGlobalSummaryRow,
  RosterRow,
} from "../infrastructure/characters.repository.js";

import { MediaService } from "../../media/index.js";
import {
  toBookCharacterView,
  toCharacterDetailsView,
  toCharacterFormView,
  toCharacterGlobalSummaryView,
  toCharacterSummaryView,
  toMaskedBookCharacterView,
} from "../domain/character.mapper.js";

@Injectable()
export class CharacterViewMapper {
  constructor(private readonly mediaService: MediaService) {}

  mediaViewOf(asset: Nullable<MediaAssetModel>): Nullable<MediaView> {
    return this.mediaService.buildViewOrNull(asset);
  }

  toDetailsView(row: CharacterDetailsRow): CharacterDetailsView {
    return toCharacterDetailsView({
      appearances: row.bookAppearances.map((appearance) => this.mapAppearance(appearance)),
      avatar: this.mediaViewOf(row.avatarMedia),
      character: row,
      forms: row.forms.map((form) => this.mapForm(form)),
    });
  }

  toGlobalSummaryView(row: CharacterGlobalSummaryRow): CharacterGlobalSummaryView {
    return toCharacterGlobalSummaryView({
      appearanceCount: row._count.bookAppearances,
      avatar: this.mediaViewOf(row.avatarMedia),
      character: row,
    });
  }

  toMaskedDetailsView({
    aliases,
    revealedFields,
    row,
    visibleAppearances,
  }: {
    aliases: CharacterDetailsRow["aliases"];
    revealedFields: ReadonlySet<CharacterRevealFieldKey>;
    row: CharacterDetailsRow;
    visibleAppearances: CharacterDetailsRow["bookAppearances"];
  }): CharacterDetailsView {
    return toCharacterDetailsView({
      appearances: visibleAppearances.map((appearance) =>
        this.mapMaskedAppearance({ appearance, revealedFields }),
      ),
      avatar: this.mediaViewOf(row.avatarMedia),
      character: { ...row, aliases },
      forms: row.forms.filter((form) => !form.isSpoiler).map((form) => this.mapForm(form)),
    });
  }

  toSummaryView(row: RosterRow): CharacterSummaryView {
    return toCharacterSummaryView({
      appearance: row,
      avatar: this.mediaViewOf(row.character.avatarMedia),
      character: row.character,
      portrait: this.mediaViewOf(row.portraitMedia),
    });
  }

  private mapAppearance(
    appearance: CharacterDetailsRow["bookAppearances"][number],
  ): BookCharacterView {
    return toBookCharacterView({
      appearance,
      portrait: this.mediaViewOf(appearance.portraitMedia),
    });
  }

  private mapForm(form: CharacterDetailsRow["forms"][number]): CharacterFormView {
    return toCharacterFormView({ form, portrait: this.mediaViewOf(form.portraitMedia) });
  }

  private mapMaskedAppearance({
    appearance,
    revealedFields,
  }: {
    appearance: CharacterDetailsRow["bookAppearances"][number];
    revealedFields: ReadonlySet<CharacterRevealFieldKey>;
  }): BookCharacterView {
    return toMaskedBookCharacterView({
      appearance,
      portrait: this.mediaViewOf(appearance.portraitMedia),
      revealedFields,
    });
  }
}
