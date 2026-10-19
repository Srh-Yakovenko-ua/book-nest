"use client";

import type {
  BookCharacterView,
  CharacterDetailsView,
  CharacterRevealFieldKey,
  MediaView,
  Nullable,
} from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useUpdateCharacter } from "../api/use-update-character";
import { explicitImportance } from "../model/character-options";
import {
  type CharacterRevealControl,
  isFieldHidden,
  REVEAL_FOCUS_TARGET,
  revealFocusTarget,
} from "../model/character-spoiler";
import { CharacterClampedText } from "./character-clamped-text";
import { CharacterDetailsActionsMenu } from "./character-details-actions-menu";
import { CharacterSpoilerField } from "./character-spoiler-field";

type CharacterDetailsHeroProps = {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  editHref: string;
  reveal: CharacterRevealControl;
};

type HeroRevealField = Extract<CharacterRevealFieldKey, "displayName" | "portrait">;

const HERO_REVEAL_FIELDS: readonly HeroRevealField[] = ["displayName", "portrait"];

const HERO_LAYOUT = {
  descriptionLines: 3,
  withDescription:
    "[grid-template-areas:'meta_meta''portrait_headline''description_description'] sm:grid-rows-[auto_auto_1fr] sm:[grid-template-areas:'portrait_meta''portrait_headline''portrait_description']",
  withoutDescription:
    "[grid-template-areas:'meta_meta''portrait_headline'] sm:grid-rows-[auto_1fr] sm:[grid-template-areas:'portrait_meta''portrait_headline']",
} as const;

export function CharacterDetailsHero({
  appearance,
  character,
  editHref,
  reveal,
}: CharacterDetailsHeroProps) {
  const t = useTranslations("characters.page");
  const tCard = useTranslations("characters.card");
  const tImportance = useTranslations("characters.importance");
  const tSpoilers = useTranslations("characters.spoilers");
  const tToast = useTranslations("characters.toast");
  const updateCharacter = useUpdateCharacter();

  const title = appearance?.displayName ?? character.name;
  const neutralDescription = character.neutralDescription?.trim() ?? "";
  const importance = appearance === undefined ? null : explicitImportance(appearance.importance);
  const isPov = appearance?.isPovCharacter === true;
  const pendingFavorite = updateCharacter.isPending
    ? updateCharacter.variables.input.isFavorite
    : undefined;
  const isFavorite = pendingFavorite ?? character.isFavorite;
  const hiddenHeroFields =
    appearance === undefined
      ? []
      : HERO_REVEAL_FIELDS.filter((field) => isFieldHidden(appearance.hiddenFields, field));

  function toggleFavorite() {
    updateCharacter.mutate(
      { characterId: character.id, input: { isFavorite: !isFavorite } },
      { onError: () => toast.error(tToast("updateError")) },
    );
  }

  return (
    <section className="relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-detail-block md:p-7">
      <div
        className={cn(
          "grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-x-7",
          neutralDescription.length === 0
            ? HERO_LAYOUT.withoutDescription
            : HERO_LAYOUT.withDescription,
        )}
      >
        <div className="flex items-start justify-between gap-3 [grid-area:meta]">
          <div className="flex flex-wrap items-center gap-1.5">
            {importance === null ? null : (
              <Badge variant="primary">{tImportance(importance)}</Badge>
            )}
            {isPov ? (
              <Badge variant="info">
                <UiIcon name="eye" size={12} />
                {t("pov")}
              </Badge>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label={isFavorite ? tCard("unfavorite") : tCard("favorite")}
              aria-pressed={isFavorite}
              className={cn(
                "rounded-lg border-[1.5px] transition-all duration-[180ms] ease-out max-sm:size-10",
                isFavorite
                  ? "border-brand bg-brand text-white shadow-btn hover:border-primary-hover hover:bg-primary-hover hover:text-white dark:hover:bg-primary-hover [&_svg]:animate-[heart-pop_320ms_ease]"
                  : "border-border bg-card text-muted-foreground hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent",
              )}
              disabled={updateCharacter.isPending}
              onClick={toggleFavorite}
              size="icon"
              variant="ghost"
            >
              <UiIcon name={isFavorite ? "heart-fill" : "heart"} size={18} />
            </Button>
            <CharacterDetailsActionsMenu
              characterId={character.id}
              className="max-sm:size-10"
              contextBookId={appearance?.bookId ?? null}
              editHref={editHref}
            />
          </div>
        </div>

        <div className="[grid-area:portrait]">
          <HeroPortrait portrait={appearance?.portrait ?? character.avatar} title={title} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 [grid-area:headline]">
          <div className="flex flex-col gap-1.5">
            <h1
              className={cn(
                "min-w-0 self-start rounded-lg font-heading text-[1.375rem] leading-[1.15] font-semibold tracking-tight break-words text-ink sm:text-3xl sm:leading-[1.1]",
                REVEAL_FOCUS_TARGET.focusClassName,
              )}
              {...revealFocusTarget("displayName")}
            >
              {title}
            </h1>
            {title === character.name ? null : (
              <p className="text-sm text-muted-foreground">{character.name}</p>
            )}
          </div>

          {hiddenHeroFields.length === 0 ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              {hiddenHeroFields.map((field) => (
                <CharacterSpoilerField
                  hidden
                  key={field}
                  label={tSpoilers(field)}
                  reveal={{
                    field,
                    onReveal: () => void reveal.onReveal(field),
                    pending: reveal.pending === field,
                  }}
                >
                  {null}
                </CharacterSpoilerField>
              ))}
            </div>
          )}
        </div>

        {neutralDescription.length === 0 ? null : (
          <div className="min-w-0 [grid-area:description]">
            <CharacterClampedText
              collapsedLines={HERO_LAYOUT.descriptionLines}
              text={neutralDescription}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function HeroPortrait({ portrait, title }: { portrait: Nullable<MediaView>; title: string }) {
  const initial = title.trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-accent shadow-detail-cover",
        REVEAL_FOCUS_TARGET.focusClassName,
      )}
      {...revealFocusTarget("portrait")}
    >
      {portrait === null ? (
        <div className="grid size-full place-items-center bg-gradient-to-br from-accent-border to-primary text-primary-foreground">
          {initial.length === 0 ? (
            <UiIcon name="user-round" size={40} />
          ) : (
            <span className="font-heading text-5xl leading-none font-semibold">{initial}</span>
          )}
        </div>
      ) : (
        <Image
          alt={title}
          className="object-cover"
          fill
          sizes="(min-width: 640px) 152px, 104px"
          src={portrait.urls.card}
          unoptimized
        />
      )}
    </div>
  );
}
