"use client";

import type {
  BookCharacterSummaryQuery,
  BookCharacterView,
  CharacterDetailsView,
  CharacterRevealFieldKey,
} from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBook } from "@/features/books";
import { Link, useRouter } from "@/i18n/navigation";

import { useCharacterDetails } from "../api/use-character-details";
import { useUnlinkCharacter } from "../api/use-unlink-character";
import {
  BOOK_CHARACTER_STATUS,
  explicitImportance,
  explicitStatus,
} from "../model/character-options";
import {
  getBookCharactersPath,
  getCharacterDetailsPath,
  getCharacterEditPath,
} from "../model/character-routes";
import { addRevealKey, isFieldHidden, toRevealKey } from "../model/character-spoiler";
import { toCharacterReadingContext } from "../model/characters-roster-query";
import { useDeleteCharacterWithUndo } from "../model/use-delete-character-with-undo";
import { CharacterSpoilerField } from "./character-spoiler-field";
import { CharactersErrorState } from "./characters-error-state";
import { DeleteCharacterDialog } from "./delete-character-dialog";
import { UnlinkCharacterDialog } from "./unlink-character-dialog";

type CharacterDetailsPageProps = {
  characterId: string;
};

export function CharacterDetailsPage({ characterId }: CharacterDetailsPageProps) {
  const [contextBookId] = useQueryState("bookId", parseAsString);

  if (contextBookId === null) {
    return <GlobalCharacterDetails characterId={characterId} />;
  }

  return <ContextualCharacterDetails characterId={characterId} contextBookId={contextBookId} />;
}

function AppearanceRow({
  appearance,
  characterId,
  isCurrent,
}: {
  appearance: BookCharacterView;
  characterId: string;
  isCurrent: boolean;
}) {
  const t = useTranslations("characters.page");
  const tImportance = useTranslations("characters.importance");

  const importance = explicitImportance(appearance.importance);
  const { book } = appearance;

  return (
    <li>
      <Link
        aria-current={isCurrent ? "page" : undefined}
        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-accent-border aria-[current=page]:border-brand aria-[current=page]:bg-secondary/60"
        href={getCharacterDetailsPath({ bookId: book.id, characterId })}
      >
        <span className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-sm bg-accent">
          {book.cover === null ? (
            <span className="grid size-full place-items-center text-accent-foreground/70">
              <UiIcon name="book" size={16} />
            </span>
          ) : (
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="44px"
              src={book.cover.urls.thumb}
              unoptimized
            />
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">{book.title}</span>
          {book.series === null ? null : (
            <span className="truncate text-xs text-muted-foreground">
              {book.series.partNumber === null
                ? book.series.name
                : t("seriesPart", { name: book.series.name, part: book.series.partNumber })}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-1.5">
            {importance === null ? null : (
              <Badge variant="secondary">{tImportance(importance)}</Badge>
            )}
            {appearance.isPovCharacter ? <Badge variant="info">{t("pov")}</Badge> : null}
          </span>
        </span>

        {isCurrent ? (
          <span className="shrink-0 text-xs font-medium text-brand">{t("currentBook")}</span>
        ) : null}
      </Link>
    </li>
  );
}

function AppearancesSection({
  appearances,
  characterId,
  currentBookId,
}: {
  appearances: BookCharacterView[];
  characterId: string;
  currentBookId: null | string;
}) {
  const t = useTranslations("characters.page");

  if (appearances.length === 0) return null;

  return (
    <Section title={t("appearancesSection")}>
      <ul className="flex flex-col gap-2">
        {appearances.map((appearance) => (
          <AppearanceRow
            appearance={appearance}
            characterId={characterId}
            isCurrent={appearance.bookId === currentBookId}
            key={appearance.id}
          />
        ))}
      </ul>
    </Section>
  );
}

function BookContextSection({
  appearance,
  onReveal,
  revealing,
}: {
  appearance: BookCharacterView;
  onReveal: (field: string) => void;
  revealing: boolean;
}) {
  const t = useTranslations("characters.page");
  const tRole = useTranslations("characters.roleType");
  const tStatus = useTranslations("characters.status");

  const visibleRoles = appearance.roles.filter((role) => !role.isSpoiler);
  const hiddenRoleCount = appearance.roles.length - visibleRoles.length;
  const status = explicitStatus(appearance.status);
  const statusText =
    status === null
      ? null
      : status === BOOK_CHARACTER_STATUS.custom
        ? (appearance.statusCustomText ?? tStatus(status))
        : tStatus(status);

  return (
    <Section title={t("bookSection")}>
      {visibleRoles.length > 0 || hiddenRoleCount > 0 ? (
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
      ) : null}

      <SpoilerText
        appearance={appearance}
        field="status"
        label={t("status")}
        onReveal={onReveal}
        revealing={revealing}
        value={statusText}
      />
      <SpoilerText
        appearance={appearance}
        field="description"
        label={t("bookDescription")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.description}
      />
      <SpoilerText
        appearance={appearance}
        field="personalImpression"
        label={t("personalImpression")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.personalImpression}
      />
      <SpoilerText
        appearance={appearance}
        field="appearanceNotes"
        label={t("appearanceNotes")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.appearanceNotes}
      />
      <SpoilerText
        appearance={appearance}
        field="speciesOverride"
        label={t("speciesOverride")}
        onReveal={onReveal}
        revealing={revealing}
        value={appearance.speciesOverride}
      />

      <FirstAppearance appearance={appearance} />
    </Section>
  );
}

function CharacterDetailsBody({
  appearance,
  backHref,
  backLabel,
  character,
  contextBookId,
  onReveal,
  revealing,
}: {
  appearance: BookCharacterView | undefined;
  backHref: string;
  backLabel: string;
  character: CharacterDetailsView;
  contextBookId: null | string;
  onReveal: (field: string) => void;
  revealing: boolean;
}) {
  return (
    <article className="flex flex-col gap-8">
      <Link
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href={backHref}
      >
        <UiIcon name="chevron-left" size={16} />
        {backLabel}
      </Link>

      <DetailsHeader appearance={appearance} character={character} contextBookId={contextBookId} />

      {appearance === undefined ? null : (
        <BookContextSection appearance={appearance} onReveal={onReveal} revealing={revealing} />
      )}

      <ProfileSection character={character} />

      <AppearancesSection
        appearances={character.appearances}
        characterId={character.id}
        currentBookId={contextBookId}
      />

      <ManagementSection characterId={character.id} contextBookId={contextBookId} />
    </article>
  );
}

function ContextualCharacterDetails({
  characterId,
  contextBookId,
}: {
  characterId: string;
  contextBookId: string;
}) {
  const book = useBook(contextBookId);

  if (book.isPending) return <DetailsSkeleton />;

  return (
    <ContextualCharacterDetailsBody
      characterId={characterId}
      contextBookId={contextBookId}
      readingContext={book.data === undefined ? {} : toCharacterReadingContext(book.data)}
    />
  );
}

function ContextualCharacterDetailsBody({
  characterId,
  contextBookId,
  readingContext,
}: {
  characterId: string;
  contextBookId: string;
  readingContext: BookCharacterSummaryQuery;
}) {
  const t = useTranslations("characters.page");
  const [revealFieldIds, setRevealFieldIds] = useState<CharacterRevealFieldKey[]>([]);

  const details = useCharacterDetails({
    characterId,
    contextBookId,
    revealFieldIds,
    ...readingContext,
  });

  if (details.isPending) return <DetailsSkeleton />;

  if (details.isError) {
    return (
      <UnavailableContext
        characterId={characterId}
        description={t("unavailableDescription")}
        title={t("unavailableTitle")}
      />
    );
  }

  const appearance = details.data.appearances.find((entry) => entry.bookId === contextBookId);

  return (
    <CharacterDetailsBody
      appearance={appearance}
      backHref={getBookCharactersPath(contextBookId)}
      backLabel={t("backToBook")}
      character={details.data}
      contextBookId={appearance === undefined ? null : contextBookId}
      onReveal={(field) => {
        const key = toRevealKey(field);
        if (key !== null) setRevealFieldIds((current) => addRevealKey(current, key));
      }}
      revealing={details.isFetching}
    />
  );
}

function DetailsHeader({
  appearance,
  character,
  contextBookId,
}: {
  appearance: BookCharacterView | undefined;
  character: CharacterDetailsView;
  contextBookId: null | string;
}) {
  const t = useTranslations("characters.page");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");

  const displayName = appearance?.displayName ?? character.name;
  const portrait = appearance?.portrait ?? character.avatar;
  const importance = appearance === undefined ? null : explicitImportance(appearance.importance);
  const status = appearance === undefined ? null : explicitStatus(appearance.status);
  const visibleAliases = character.aliases.filter((alias) => !alias.isSpoiler);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <Avatar
        className="size-24 bg-gradient-to-br from-accent-border to-primary text-primary-foreground"
        size="lg"
      >
        {portrait === null ? null : <AvatarImage alt={displayName} src={portrait.urls.card} />}
        <AvatarFallback className="bg-transparent font-heading text-3xl font-bold text-primary-foreground">
          {displayName.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="font-heading text-3xl leading-tight text-ink">{displayName}</h1>

        {displayName === character.name ? null : (
          <p className="text-sm text-muted-foreground">{character.name}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {importance === null ? null : <Badge variant="primary">{tImportance(importance)}</Badge>}
          {appearance?.isPovCharacter === true ? (
            <Badge variant="info">
              <UiIcon name="eye" size={12} />
              {t("pov")}
            </Badge>
          ) : null}
          {status === null ? null : <Badge variant="secondary">{tStatus(status)}</Badge>}
          {character.isFavorite ? (
            <Badge variant="default">
              <UiIcon name="heart-fill" size={12} />
              {t("favorite")}
            </Badge>
          ) : null}
        </div>

        {visibleAliases.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleAliases.map((alias) => (
              <Badge key={alias.id} variant="outline">
                {alias.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <Button asChild className="shrink-0" variant="secondary">
        <Link
          href={getCharacterEditPath({
            characterId: character.id,
            ...(contextBookId === null ? {} : { bookId: contextBookId }),
          })}
        >
          <UiIcon name="edit" size={16} />
          {t("edit")}
        </Link>
      </Button>
    </header>
  );
}

function DetailsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-8" role="status">
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-6">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
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

function FirstAppearance({ appearance }: { appearance: BookCharacterView }) {
  const t = useTranslations("characters.page");

  const parts = [
    appearance.firstAppearanceChapter,
    appearance.firstAppearancePage === null
      ? null
      : t("firstAppearancePage", { page: appearance.firstAppearancePage }),
    appearance.firstAppearanceNote,
  ].filter((part) => part !== null);

  if (parts.length === 0) return null;

  return (
    <dl>
      <Field label={t("firstAppearance")}>{parts.join(" · ")}</Field>
    </dl>
  );
}

function GlobalCharacterDetails({ characterId }: { characterId: string }) {
  const t = useTranslations("characters.page");
  const details = useCharacterDetails({ characterId });

  if (details.isPending) return <DetailsSkeleton />;

  if (details.isError) {
    return (
      <div role="alert">
        <CharactersErrorState onRetry={() => void details.refetch()} />
      </div>
    );
  }

  return (
    <CharacterDetailsBody
      appearance={undefined}
      backHref="/my-library"
      backLabel={t("backToLibrary")}
      character={details.data}
      contextBookId={null}
      onReveal={() => undefined}
      revealing={false}
    />
  );
}

function ManagementAction({
  description,
  label,
  onClick,
  variant,
}: {
  description: string;
  label: string;
  onClick: () => void;
  variant?: "destructive";
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button className="shrink-0" onClick={onClick} variant={variant ?? "secondary"}>
        {label}
      </Button>
    </div>
  );
}

function ManagementSection({
  characterId,
  contextBookId,
}: {
  characterId: string;
  contextBookId: null | string;
}) {
  const t = useTranslations("characters.page");
  const tCard = useTranslations("characters.card");
  const tToast = useTranslations("characters.toast");
  const router = useRouter();
  const unlinkCharacter = useUnlinkCharacter();
  const deleteCharacter = useDeleteCharacterWithUndo();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmUnlink() {
    if (contextBookId === null) return;
    unlinkCharacter.mutate(
      { bookId: contextBookId, characterId },
      {
        onError: () => toast.error(tToast("unlinkError")),
        onSuccess: () => {
          toast.success(tToast("unlinked"));
          setUnlinkOpen(false);
          router.push(getCharacterDetailsPath({ characterId }));
        },
      },
    );
  }

  return (
    <Section title={t("managementSection")}>
      {contextBookId === null ? null : (
        <ManagementAction
          description={t("unlinkDescription")}
          label={tCard("unlink")}
          onClick={() => setUnlinkOpen(true)}
        />
      )}

      <ManagementAction
        description={t("deleteDescription")}
        label={t("deleteAction")}
        onClick={() => setDeleteOpen(true)}
        variant="destructive"
      />

      <UnlinkCharacterDialog
        isUnlinking={unlinkCharacter.isPending}
        onConfirm={confirmUnlink}
        onOpenChange={setUnlinkOpen}
        open={unlinkOpen}
      />

      <DeleteCharacterDialog
        characterId={characterId}
        isDeleting={deleteCharacter.isPending}
        onConfirm={() =>
          deleteCharacter.deleteWithUndo(characterId, () => {
            setDeleteOpen(false);
            router.push(
              contextBookId === null ? "/my-library" : getBookCharactersPath(contextBookId),
            );
          })
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </Section>
  );
}

function ProfileSection({ character }: { character: CharacterDetailsView }) {
  const t = useTranslations("characters.page");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");
  const tAttitude = useTranslations("characters.attitude");

  const gender =
    character.gender === "custom"
      ? (character.customGender ?? tGender("custom"))
      : tGender(character.gender);

  return (
    <Section title={t("profileSection")}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label={t("entityKind")}>{tEntity(character.entityKind)}</Field>
        <Field label={t("gender")}>{gender}</Field>
        {character.species === null ? null : (
          <Field label={t("species")}>{character.species}</Field>
        )}
        {character.pronouns === null ? null : (
          <Field label={t("pronouns")}>{character.pronouns}</Field>
        )}
        {character.globalAttitude === null ? null : (
          <Field label={t("attitude")}>{tAttitude(character.globalAttitude)}</Field>
        )}
      </dl>

      {character.neutralDescription === null ? null : (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
          {character.neutralDescription}
        </p>
      )}
    </Section>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg text-ink">{title}</h2>
      {children}
    </section>
  );
}

function SpoilerText({
  appearance,
  field,
  label,
  onReveal,
  revealing,
  value,
}: {
  appearance: BookCharacterView;
  field: string;
  label: string;
  onReveal: (field: string) => void;
  revealing: boolean;
  value: null | string;
}) {
  const hidden = isFieldHidden(appearance.hiddenFields, field);
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

function UnavailableContext({
  characterId,
  description,
  title,
}: {
  characterId: string;
  description: string;
  title: string;
}) {
  const t = useTranslations("characters.page");

  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
      role="alert"
    >
      <span className="grid size-14 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name="lock" size={24} />
      </span>
      <h1 className="font-heading text-2xl text-ink">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="secondary">
        <Link href={getCharacterDetailsPath({ characterId })}>{t("openGlobalProfile")}</Link>
      </Button>
    </div>
  );
}
