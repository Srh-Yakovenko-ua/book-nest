"use client";

import type { BookCharacterView, CharacterRevealFieldKey, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

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
import { CharacterClampedText } from "./character-clamped-text";
import { CharacterHiddenGroupNotice } from "./character-hidden-group-notice";
import { CharacterOverviewCard } from "./character-overview-card";
import { CharacterSpoilerField } from "./character-spoiler-field";

type BookFieldsProps = {
  appearance: BookCharacterView;
  reveal: CharacterRevealControl;
};

type BookTextFieldKey = Extract<
  CharacterRevealFieldKey,
  "appearanceNotes" | "description" | "personalImpression"
>;

const DIGITS_ONLY = /^\d+$/;

export function BookBasicsFields({ appearance, reveal }: BookFieldsProps) {
  const t = useTranslations("characters.page");
  const tStatus = useTranslations("characters.status");
  const speciesLabel = useSpeciesLabel();

  const status = explicitStatus(appearance.status);
  const statusText =
    status === null
      ? null
      : status === BOOK_CHARACTER_STATUS.custom
        ? (appearance.statusCustomText ?? tStatus(status))
        : tStatus(status);
  const showsSpeciesOverride = hasSpeciesOverride(appearance);
  const showsStatus = hasStatus(appearance);

  return (
    <div className="flex flex-col gap-4">
      {showsSpeciesOverride || showsStatus ? (
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {showsSpeciesOverride ? (
            <CharacterSpoilerField
              hidden={isFieldHidden(appearance.hiddenFields, "speciesOverride")}
              label={t("speciesOverride")}
              reveal={revealPropsOf(reveal, "speciesOverride")}
            >
              {speciesLabel(appearance.speciesOverride)}
            </CharacterSpoilerField>
          ) : null}
          {showsStatus ? (
            <CharacterSpoilerField
              hidden={isFieldHidden(appearance.hiddenFields, "status")}
              label={t("status")}
              reveal={revealPropsOf(reveal, "status")}
            >
              {statusText}
            </CharacterSpoilerField>
          ) : null}
        </div>
      ) : null}
      {hasRoles(appearance) ? <RolesGroup appearance={appearance} reveal={reveal} /> : null}
    </div>
  );
}

export function BookImpressionFields({ appearance, reveal }: BookFieldsProps) {
  const t = useTranslations("characters.page");
  const tAttitude = useTranslations("characters.attitude");

  return (
    <div className="flex flex-col gap-4">
      {appearance.attitude === null ? null : (
        <TraitCell focusField={null} label={t("attitude")}>
          {tAttitude(appearance.attitude)}
        </TraitCell>
      )}
      {hasBookText(appearance, "personalImpression") ? (
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
      ) : null}
    </div>
  );
}

export function CharacterDescriptionsCard({ appearance, reveal }: BookFieldsProps) {
  const t = useTranslations("characters.page");
  const tEdit = useTranslations("characters.edit");
  const hasDescription = hasBookText(appearance, "description");
  const hasAppearanceNotes = hasBookText(appearance, "appearanceNotes");

  if (!hasDescription && !hasAppearanceNotes) return null;

  return (
    <FormSection icon="book-open-text" title={tEdit("descriptionsSection")}>
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

export function CharacterNarrativeCard({ appearance, reveal }: BookFieldsProps) {
  const t = useTranslations("characters.edit");

  return (
    <CharacterOverviewCard
      groups={[
        hasFirstAppearance(appearance)
          ? {
              content: <FirstAppearance appearance={appearance} />,
              key: "first-appearance",
              title: t("firstAppearance"),
            }
          : null,
        hasNarrator(appearance)
          ? {
              content: <NarratorCell appearance={appearance} reveal={reveal} />,
              key: "perspective",
              title: t("perspectiveGroup"),
            }
          : null,
      ]}
      icon="quote"
      title={t("narrativeSection")}
    />
  );
}

export function hasBookBasics(appearance: BookCharacterView): boolean {
  return hasSpeciesOverride(appearance) || hasStatus(appearance) || hasRoles(appearance);
}

export function hasBookImpression(appearance: BookCharacterView): boolean {
  return appearance.attitude !== null || hasBookText(appearance, "personalImpression");
}

export function hasBookOverview(appearance: BookCharacterView): boolean {
  return (
    hasBookBasics(appearance) ||
    hasBookText(appearance, "description") ||
    hasBookText(appearance, "appearanceNotes") ||
    hasFirstAppearance(appearance) ||
    hasNarrator(appearance) ||
    hasBookImpression(appearance)
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

function hasSpeciesOverride(appearance: BookCharacterView): boolean {
  return (
    appearance.speciesOverride !== null || isFieldHidden(appearance.hiddenFields, "speciesOverride")
  );
}

function hasStatus(appearance: BookCharacterView): boolean {
  return (
    explicitStatus(appearance.status) !== null || isFieldHidden(appearance.hiddenFields, "status")
  );
}

function NarratorCell({ appearance, reveal }: BookFieldsProps) {
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

function RolesGroup({ appearance, reveal }: BookFieldsProps) {
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

function TraitCell({
  children,
  focusField,
  label,
}: {
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
    </div>
  );
}
