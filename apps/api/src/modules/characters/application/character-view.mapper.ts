import type {
  BookCharacterRosterItem,
  BookCharacterView,
  CharacterAppearanceBook,
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
import type { VisibleAliases } from "../domain/alias-groups.js";
import type { VisibleForms } from "../domain/visible-forms.js";
import type {
  CharacterDetailsRow,
  CharacterGlobalSummaryRow,
  RosterPageRow,
  RosterSummaryRow,
} from "../infrastructure/characters.repository.js";

import { MediaService } from "../../media/index.js";
import { toBookCharacterRosterItem } from "../domain/book-character-roster-item.js";
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
    revealedFields,
    row,
    visibleAliases,
    visibleForms,
  }: {
    revealedFields: ReadonlySet<CharacterRevealFieldKey>;
    row: CharacterDetailsRow;
    visibleAliases: VisibleAliases<CharacterDetailsRow["aliases"][number]>;
    visibleForms: VisibleForms<CharacterDetailsRow["forms"][number]>;
  }): CharacterDetailsView {
    return toCharacterDetailsView({
      appearances: row.bookAppearances.map((appearance) =>
        this.mapMaskedAppearance({ appearance, revealedFields }),
      ),
      avatar: this.mediaViewOf(row.avatarMedia),
      character: { ...row, aliases: visibleAliases.aliases },
      characterHiddenFields: [...visibleAliases.hiddenFields, ...visibleForms.hiddenFields],
      forms: visibleForms.forms.map((form) => this.mapForm(form)),
    });
  }

  toRosterItem(row: RosterPageRow): BookCharacterRosterItem {
    return toBookCharacterRosterItem({
      appearance: row,
      avatar: this.mediaViewOf(row.character.avatarMedia),
      character: row.character,
      portrait: this.mediaViewOf(row.portraitMedia),
    });
  }

  toSummaryView(row: RosterSummaryRow): CharacterSummaryView {
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
      book: this.mapAppearanceBook(appearance.book),
      portrait: this.mediaViewOf(appearance.portraitMedia),
    });
  }

  private mapAppearanceBook(
    book: CharacterDetailsRow["bookAppearances"][number]["book"],
  ): CharacterAppearanceBook {
    return {
      cover: this.mediaViewOf(book.coverMedia),
      id: book.id,
      series:
        book.series === null
          ? null
          : { id: book.series.id, name: book.series.name, partNumber: book.partNumber },
      title: book.title,
    };
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
      book: this.mapAppearanceBook(appearance.book),
      portrait: this.mediaViewOf(appearance.portraitMedia),
      revealedFields,
    });
  }
}
