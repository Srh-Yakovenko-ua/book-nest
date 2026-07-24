"use client";

import type {
  BookCharacterView,
  CharacterAttitude,
  CharacterDetailsView,
  CharacterRevealFieldKey,
} from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { useCharacterDetails } from "../api/use-character-details";
import { addRevealKey, isFieldHidden, toRevealKey } from "../model/character-spoiler";
import { CharacterSpoilerField } from "./character-spoiler-field";
import { CharactersErrorState } from "./characters-error-state";

type CharacterDetailsSheetProps = {
  characterId: null | string;
  contextBookId?: string;
  onEdit: (characterId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function CharacterDetailsSheet({
  characterId,
  contextBookId,
  onEdit,
  onOpenChange,
  open,
}: CharacterDetailsSheetProps) {
  const t = useTranslations("characters.details");

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("sheetDescription")}</SheetDescription>
        </SheetHeader>
        {open && characterId !== null ? (
          <CharacterDetailsBody
            characterId={characterId}
            contextBookId={contextBookId}
            onEdit={() => onEdit(characterId)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AttitudeLabel({ attitude }: { attitude: CharacterAttitude }) {
  const t = useTranslations("characters.attitude");
  return <>{t(attitude)}</>;
}

function BookSection({
  appearance,
  onReveal,
  revealing,
}: {
  appearance: BookCharacterView;
  onReveal: (field: string) => void;
  revealing: boolean;
}) {
  const t = useTranslations("characters.details");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const tRole = useTranslations("characters.roleType");
  const tNarrator = useTranslations("characters.narratorType");

  const visibleRoles = appearance.roles.filter((role) => !role.isSpoiler);
  const hiddenRoleCount = appearance.roles.length - visibleRoles.length;

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <h4 className="text-sm font-semibold text-ink">{t("bookSection")}</h4>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="primary">{tImportance(appearance.importance)}</Badge>
        {appearance.isPovCharacter ? (
          <Badge variant="info">
            <UiIcon name="eye" size={12} />
            {appearance.narratorType === null
              ? t("pov")
              : t("povWithType", { type: tNarrator(appearance.narratorType) })}
          </Badge>
        ) : null}
      </div>

      {visibleRoles.length > 0 || hiddenRoleCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("roles")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {visibleRoles.map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.roleType === "custom" && role.customRole !== null
                  ? role.customRole
                  : tRole(role.roleType)}
              </Badge>
            ))}
            {hiddenRoleCount > 0 ? (
              <Badge variant="warning">
                <UiIcon name="lock" size={12} />
                {t("hiddenRoles", { count: hiddenRoleCount })}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}

      <SpoilerText
        field="status"
        hiddenFields={appearance.hiddenFields}
        label={t("status")}
        onReveal={onReveal}
        revealing={revealing}
        value={
          appearance.status === null
            ? null
            : appearance.status === "other" && appearance.statusCustomText !== null
              ? appearance.statusCustomText
              : tStatus(appearance.status)
        }
      />

      <SpoilerText
        field="displayName"
        hiddenFields={appearance.hiddenFields}
        label={t("displayName")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.displayName}
      />

      <SpoilerText
        field="description"
        hiddenFields={appearance.hiddenFields}
        label={t("bookDescription")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.description}
      />

      <SpoilerText
        field="personalImpression"
        hiddenFields={appearance.hiddenFields}
        label={t("personalImpression")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.personalImpression}
      />

      <SpoilerText
        field="appearanceNotes"
        hiddenFields={appearance.hiddenFields}
        label={t("appearanceNotes")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.appearanceNotes}
      />

      <SpoilerText
        field="speciesOverride"
        hiddenFields={appearance.hiddenFields}
        label={t("speciesOverride")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.speciesOverride}
      />

      {appearance.attitude === null ? null : (
        <Field label={t("attitude")}>
          <AttitudeLabel attitude={appearance.attitude} />
        </Field>
      )}
    </section>
  );
}

function CharacterDetailsBody({
  characterId,
  contextBookId,
  onEdit,
}: {
  characterId: string;
  contextBookId?: string;
  onEdit: () => void;
}) {
  const t = useTranslations("characters.details");
  const [revealFieldIds, setRevealFieldIds] = useState<CharacterRevealFieldKey[]>([]);

  const details = useCharacterDetails({ characterId, contextBookId, revealFieldIds });

  function reveal(field: string) {
    const key = toRevealKey(field);
    if (key === null) return;
    setRevealFieldIds((current) => addRevealKey(current, key));
  }

  if (details.isError) {
    return (
      <div className="p-5" role="alert">
        <CharactersErrorState onRetry={() => void details.refetch()} />
      </div>
    );
  }

  if (details.isPending) {
    return <DetailsSkeleton />;
  }

  const character = details.data;
  const appearance =
    contextBookId === undefined
      ? undefined
      : character.appearances.find((entry) => entry.bookId === contextBookId);
  const otherAppearances = character.appearances.filter(
    (entry) => entry.bookId !== contextBookId,
  ).length;
  const revealing = details.isFetching;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
      <DetailsHeader appearance={appearance} character={character} onEdit={onEdit} />

      <GeneralSection character={character} />

      {appearance === undefined ? null : (
        <BookSection appearance={appearance} onReveal={reveal} revealing={revealing} />
      )}

      {otherAppearances > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("otherAppearances", { count: otherAppearances })}
        </p>
      ) : null}
    </div>
  );
}

function DetailsHeader({
  appearance,
  character,
  onEdit,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  onEdit: () => void;
}) {
  const t = useTranslations("characters.details");
  const displayName = appearance?.displayName ?? character.name;
  const portrait = appearance?.portrait ?? character.avatar;
  const visibleAliases = character.aliases.filter((alias) => !alias.isSpoiler);

  return (
    <div className="flex items-start gap-4">
      <Avatar
        className="size-16 bg-gradient-to-br from-accent-border to-primary text-primary-foreground"
        size="lg"
      >
        {portrait === null ? null : <AvatarImage alt={displayName} src={portrait.urls.card} />}
        <AvatarFallback className="bg-transparent font-heading text-2xl font-bold text-primary-foreground">
          {displayName.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-xl leading-tight text-ink">{displayName}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {character.isFavorite ? (
              <span className="text-brand" title={t("favorite")}>
                <UiIcon aria-label={t("favorite")} name="heart-fill" size={18} />
              </span>
            ) : null}
            <Button aria-label={t("edit")} onClick={onEdit} size="icon-sm" variant="ghost">
              <UiIcon name="edit" size={18} />
            </Button>
          </div>
        </div>

        {displayName === character.name ? null : (
          <p className="text-sm text-muted-foreground">{character.name}</p>
        )}

        {visibleAliases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleAliases.map((alias) => (
              <Badge key={alias.id} variant="secondary">
                {alias.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6 px-5 py-5" role="status">
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function GeneralSection({ character }: { character: CharacterDetailsView }) {
  const t = useTranslations("characters.details");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");

  const gender =
    character.gender === "custom"
      ? (character.customGender ?? tGender("custom"))
      : tGender(character.gender);

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-ink">{t("generalSection")}</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label={t("entityKind")}>{tEntity(character.entityKind)}</Field>
        <Field label={t("gender")}>{gender}</Field>
        {character.species === null ? null : (
          <Field label={t("species")}>{character.species}</Field>
        )}
        {character.pronouns === null ? null : (
          <Field label={t("pronouns")}>{character.pronouns}</Field>
        )}
        {character.globalAttitude === null ? null : (
          <Field label={t("attitude")}>
            <AttitudeLabel attitude={character.globalAttitude} />
          </Field>
        )}
      </dl>
      {character.neutralDescription === null ? null : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("description")}
          </span>
          <p className="text-sm leading-relaxed text-foreground">{character.neutralDescription}</p>
        </div>
      )}
    </section>
  );
}

function SpoilerText({
  field,
  hiddenFields,
  label,
  onReveal,
  revealing,
  value,
}: {
  field: string;
  hiddenFields: readonly string[];
  label: string;
  onReveal: (field: string) => void;
  revealing: boolean;
  value: null | string;
}) {
  const hidden = isFieldHidden(hiddenFields, field);
  if (!hidden && value === null) return null;

  return (
    <CharacterSpoilerField
      hidden={hidden}
      label={label}
      onReveal={() => onReveal(field)}
      revealing={revealing}
    >
      <p className="whitespace-pre-line">{value}</p>
    </CharacterSpoilerField>
  );
}
