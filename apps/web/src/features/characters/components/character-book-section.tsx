"use client";

import type {
  BookCharacterView,
  CharacterDetailsView,
  CharacterRevealFieldKey,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormSection } from "@/features/books";
import { useSpeciesLabel } from "@/features/species";
import { cn } from "@/lib/utils";

import { formatAudioPosition } from "../model/character-first-appearance";
import { BOOK_CHARACTER_STATUS, explicitStatus } from "../model/character-options";
import {
  type CharacterRevealControl,
  isFieldHidden,
  REVEAL_FOCUS_TARGET,
  revealFocusTarget,
} from "../model/character-spoiler";
import { CharacterAliasCard } from "./character-alias-card";
import { CharacterClampedText } from "./character-clamped-text";
import { CharacterHiddenGroupNotice } from "./character-hidden-group-notice";
import { CharacterSpoilerField } from "./character-spoiler-field";

type BookCardProps = {
  appearance: BookCharacterView;
  character: CharacterDetailsView;
  reveal: CharacterRevealControl;
};

type BookTextFieldKey = Extract<
  CharacterRevealFieldKey,
  "appearanceNotes" | "description" | "personalImpression"
>;

const DIGITS_ONLY = /^\d+$/;

export function CharacterBookSection({ appearance, character, reveal }: BookCardProps) {
  const t = useTranslations("characters.page");
  const headingId = useId();

  const bookAliases = character.aliases.filter((alias) => alias.bookId === appearance.bookId);
  const bookAliasesHidden = isFieldHidden(character.hiddenFields, "bookAliases");
  const hasContent =
    hasTraits({ appearance, character }) ||
    hasBookText(appearance, "description") ||
    hasBookText(appearance, "appearanceNotes") ||
    hasBookText(appearance, "personalImpression") ||
    bookAliases.length > 0 ||
    bookAliasesHidden;

  if (!hasContent) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 className="font-heading text-xl text-ink" id={headingId}>
        {t("bookSection")}
      </h2>
      <TraitsCard appearance={appearance} character={character} reveal={reveal} />
      <DescriptionCard appearance={appearance} reveal={reveal} />
      <ImpressionCard appearance={appearance} reveal={reveal} />
      <CharacterAliasCard
        aliases={bookAliases}
        field="bookAliases"
        hidden={bookAliasesHidden}
        reveal={reveal}
        title={t("bookAliases")}
      />
    </section>
  );
}

function BookTextField({
  appearance,
  fadeClassName,
  field,
  label,
  reveal,
}: {
  appearance: BookCharacterView;
  fadeClassName?: string;
  field: BookTextFieldKey;
  label: string;
  reveal: CharacterRevealControl;
}) {
  const hidden = isFieldHidden(appearance.hiddenFields, field);
  const text = appearance[field]?.trim() ?? "";
  if (!hidden && text.length === 0) return null;

  return (
    <CharacterSpoilerField hidden={hidden} label={label} reveal={revealPropsOf(reveal, field)}>
      <CharacterClampedText
        defaultExpanded={reveal.isRevealed(field)}
        fadeClassName={fadeClassName}
        text={text}
      />
    </CharacterSpoilerField>
  );
}

function DescriptionCard({
  appearance,
  reveal,
}: {
  appearance: BookCharacterView;
  reveal: CharacterRevealControl;
}) {
  const t = useTranslations("characters.page");
  const hasDescription = hasBookText(appearance, "description");
  const hasAppearanceNotes = hasBookText(appearance, "appearanceNotes");

  if (!hasDescription && !hasAppearanceNotes) return null;

  return (
    <FormSection icon="file-text" title={t("descriptionCard")}>
      <BookTextField
        appearance={appearance}
        field="description"
        label={t("bookDescription")}
        reveal={reveal}
      />
      {hasDescription && hasAppearanceNotes ? <Separator /> : null}
      <BookTextField
        appearance={appearance}
        field="appearanceNotes"
        label={t("appearanceNotes")}
        reveal={reveal}
      />
    </FormSection>
  );
}

function FirstAppearance({ appearance }: { appearance: BookCharacterView }) {
  const t = useTranslations("characters.page");
  const chapter = appearance.firstAppearanceChapter;
  const note = appearance.firstAppearanceNote?.trim() ?? "";
  const facts = [
    chapter === null
      ? null
      : DIGITS_ONLY.test(chapter)
        ? t("firstAppearanceChapter", { chapter })
        : chapter,
    appearance.firstAppearancePage === null
      ? null
      : t("firstAppearancePage", { page: appearance.firstAppearancePage }),
    appearance.firstAppearanceAudioSeconds === null
      ? null
      : t("firstAppearanceAudio", {
          time: formatAudioPosition(appearance.firstAppearanceAudioSeconds),
        }),
  ].filter((fact) => fact !== null);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("firstAppearance")}
      </span>
      {facts.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <li
              className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-xs font-medium text-foreground tabular-nums"
              key={fact}
            >
              {fact}
            </li>
          ))}
        </ul>
      )}
      {note.length === 0 ? null : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{note}</p>
      )}
    </div>
  );
}

function hasBookText(appearance: BookCharacterView, field: BookTextFieldKey): boolean {
  return (
    isFieldHidden(appearance.hiddenFields, field) || (appearance[field]?.trim() ?? "").length > 0
  );
}

function hasFirstAppearance(appearance: BookCharacterView): boolean {
  return (
    appearance.firstAppearanceChapter !== null ||
    appearance.firstAppearancePage !== null ||
    appearance.firstAppearanceAudioSeconds !== null ||
    (appearance.firstAppearanceNote?.trim() ?? "").length > 0
  );
}

function hasNarrator(appearance: BookCharacterView): boolean {
  return (
    appearance.isPovCharacter &&
    (appearance.narratorType !== null ||
      appearance.isUnreliableNarrator === true ||
      isFieldHidden(appearance.hiddenFields, "unreliableNarrator"))
  );
}

function hasRoles(appearance: BookCharacterView): boolean {
  return appearance.roles.length > 0 || isFieldHidden(appearance.hiddenFields, "roles");
}

function hasTraitGrid({
  appearance,
  character,
}: {
  appearance: BookCharacterView;
  character: CharacterDetailsView;
}): boolean {
  return (
    isFieldHidden(appearance.hiddenFields, "status") ||
    explicitStatus(appearance.status) !== null ||
    isFieldHidden(appearance.hiddenFields, "speciesOverride") ||
    appearance.speciesOverride !== null ||
    character.species !== null ||
    (appearance.attitude ?? character.globalAttitude) !== null ||
    hasNarrator(appearance)
  );
}

function hasTraits(args: { appearance: BookCharacterView; character: CharacterDetailsView }) {
  return hasTraitGrid(args) || hasRoles(args.appearance) || hasFirstAppearance(args.appearance);
}

function ImpressionCard({
  appearance,
  reveal,
}: {
  appearance: BookCharacterView;
  reveal: CharacterRevealControl;
}) {
  const t = useTranslations("characters.page");

  if (!hasBookText(appearance, "personalImpression")) return null;

  return (
    <FormSection icon="heart" title={t("impressionCard")}>
      <div className="flex gap-3 rounded-[14px] border-l-2 border-l-[var(--terracotta)] bg-muted/50 p-3.5 sm:p-4">
        <Quote aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--terracotta)]" />
        <div className="min-w-0 flex-1">
          <BookTextField
            appearance={appearance}
            fadeClassName="from-muted/50"
            field="personalImpression"
            label={t("impressionCaption")}
            reveal={reveal}
          />
        </div>
      </div>
    </FormSection>
  );
}

function NarratorCell({
  appearance,
  reveal,
}: {
  appearance: BookCharacterView;
  reveal: CharacterRevealControl;
}) {
  const t = useTranslations("characters.page");
  const tNarrator = useTranslations("characters.narratorType");
  const unreliableHidden = isFieldHidden(appearance.hiddenFields, "unreliableNarrator");

  return (
    <TraitCell focusField={unreliableHidden ? null : "unreliableNarrator"} label={t("narrator")}>
      {appearance.narratorType === null ? null : <p>{tNarrator(appearance.narratorType)}</p>}
      {unreliableHidden ? (
        <CharacterSpoilerField
          hidden
          label={t("unreliableNarrator")}
          reveal={revealPropsOf(reveal, "unreliableNarrator")}
        >
          {null}
        </CharacterSpoilerField>
      ) : appearance.isUnreliableNarrator === true ? (
        <p className="text-muted-foreground">{t("unreliableNarrator")}</p>
      ) : null}
    </TraitCell>
  );
}

function revealPropsOf(reveal: CharacterRevealControl, field: CharacterRevealFieldKey) {
  return {
    field,
    onReveal: () => void reveal.onReveal(field),
    pending: reveal.pending === field,
  };
}

function RolesGroup({
  appearance,
  reveal,
}: {
  appearance: BookCharacterView;
  reveal: CharacterRevealControl;
}) {
  const t = useTranslations("characters.page");
  const tRole = useTranslations("characters.roleType");
  const labelId = useId();

  return (
    <div
      aria-labelledby={labelId}
      className={cn("flex flex-col gap-2 rounded-lg", REVEAL_FOCUS_TARGET.focusClassName)}
      role="group"
      {...revealFocusTarget("roles")}
    >
      <span
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        id={labelId}
      >
        {t("roles")}
      </span>
      {appearance.roles.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5">
          {appearance.roles.map((role) => (
            <li key={role.id}>
              <Badge variant="secondary">
                {role.roleType === "custom" && role.customRole !== null
                  ? role.customRole
                  : tRole(role.roleType)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {isFieldHidden(appearance.hiddenFields, "roles") ? (
        <CharacterHiddenGroupNotice
          actionLabel={t("revealHiddenRoles")}
          message={t("hiddenRolesNotice")}
          onReveal={() => void reveal.onReveal("roles")}
          revealing={reveal.pending === "roles"}
        />
      ) : null}
    </div>
  );
}

function SpeciesCell({
  appearance,
  character,
  reveal,
}: {
  appearance: BookCharacterView;
  character: CharacterDetailsView;
  reveal: CharacterRevealControl;
}) {
  const t = useTranslations("characters.page");
  const speciesLabel = useSpeciesLabel();
  const overrideHidden = isFieldHidden(appearance.hiddenFields, "speciesOverride");

  if (appearance.speciesOverride !== null) {
    return (
      <TraitCell caption={t("sourceBook")} focusField="speciesOverride" label={t("species")}>
        {speciesLabel(appearance.speciesOverride)}
      </TraitCell>
    );
  }

  const hiddenOverride = overrideHidden ? (
    <CharacterSpoilerField
      hidden
      label={t("speciesOverride")}
      reveal={revealPropsOf(reveal, "speciesOverride")}
    >
      {null}
    </CharacterSpoilerField>
  ) : null;

  if (character.species === null) return hiddenOverride;

  return (
    <TraitCell caption={t("sourceGlobal")} focusField={null} label={t("species")}>
      {speciesLabel(character.species)}
      {hiddenOverride === null ? null : <div className="mt-2">{hiddenOverride}</div>}
    </TraitCell>
  );
}

function TraitCell({
  caption,
  children,
  focusField,
  label,
}: {
  caption?: string;
  children: ReactNode;
  focusField: Nullable<CharacterRevealFieldKey>;
  label: string;
}) {
  const labelId = useId();

  return (
    <div
      aria-labelledby={labelId}
      className={cn(
        "flex flex-col gap-1",
        focusField === null ? null : ["rounded-lg", REVEAL_FOCUS_TARGET.focusClassName],
      )}
      role="group"
      {...(focusField === null ? {} : revealFocusTarget(focusField))}
    >
      <span
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        id={labelId}
      >
        {label}
      </span>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
      {caption === undefined ? null : (
        <span className="text-xs text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}

function TraitsCard({ appearance, character, reveal }: BookCardProps) {
  const t = useTranslations("characters.page");
  const tAttitude = useTranslations("characters.attitude");
  const tStatus = useTranslations("characters.status");

  const statusHidden = isFieldHidden(appearance.hiddenFields, "status");
  const status = explicitStatus(appearance.status);
  const statusText =
    status === null
      ? null
      : status === BOOK_CHARACTER_STATUS.custom
        ? (appearance.statusCustomText ?? tStatus(status))
        : tStatus(status);
  const attitude = appearance.attitude ?? character.globalAttitude;

  const zones = [
    hasTraitGrid({ appearance, character }) ? (
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2" key="traits">
        {statusHidden || statusText !== null ? (
          <CharacterSpoilerField
            hidden={statusHidden}
            label={t("status")}
            reveal={revealPropsOf(reveal, "status")}
          >
            {statusText}
          </CharacterSpoilerField>
        ) : null}
        <SpeciesCell appearance={appearance} character={character} reveal={reveal} />
        {attitude === null ? null : (
          <TraitCell
            caption={appearance.attitude === null ? t("sourceGlobal") : t("sourceBook")}
            focusField={null}
            label={t("attitude")}
          >
            {tAttitude(attitude)}
          </TraitCell>
        )}
        {hasNarrator(appearance) ? <NarratorCell appearance={appearance} reveal={reveal} /> : null}
      </div>
    ) : null,
    hasRoles(appearance) ? (
      <RolesGroup appearance={appearance} key="roles" reveal={reveal} />
    ) : null,
    hasFirstAppearance(appearance) ? (
      <FirstAppearance appearance={appearance} key="first-appearance" />
    ) : null,
  ].filter((zone) => zone !== null);

  if (zones.length === 0) return null;

  return (
    <FormSection icon="user" title={t("traitsCard")}>
      {zones.map((zone, index) => (
        <Fragment key={zone.key}>
          {index === 0 ? null : <Separator />}
          {zone}
        </Fragment>
      ))}
    </FormSection>
  );
}
