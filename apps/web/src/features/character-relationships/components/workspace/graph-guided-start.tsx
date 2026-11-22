"use client";

import type {
  BookCharacterSummaryView,
  BookView,
  CharacterSummaryView,
  Nullable,
} from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toCharacterBookContext, useBookCharacterSummary } from "@/features/characters";
import { Link } from "@/i18n/navigation";

import { getBookCharactersListPath } from "../../model/workspace/graph-workspace-routes";
import { GraphWorkspaceMessage } from "./graph-workspace-message";

const GUIDED_START = {
  illustration: {
    height: 1086,
    sizes: "(min-width: 768px) 360px, 70vw",
    src: "/illustrations/character-relationships/person-guided-start.png",
    width: 1448,
  },
  skeletonCount: 6,
  topLimit: 6,
} as const;

type GraphGuidedStartProps = {
  book: BookView;
  onChoose: (characterId: string) => void;
  view: "person" | "tree";
};

export function GraphGuidedStart({ book, onChoose, view }: GraphGuidedStartProps) {
  const t = useTranslations("relationships.workspace.guided");
  const summary = useBookCharacterSummary(book.id, toCharacterBookContext(book));

  if (summary.isError) {
    return (
      <GraphWorkspaceMessage
        action={{ label: t("retry"), onClick: () => void summary.refetch() }}
        description={t("errorDescription")}
        title={t("errorTitle")}
      />
    );
  }

  if (summary.data?.totalVisibleCharacters === 0) {
    return (
      <GraphWorkspaceMessage
        description={t("noCharactersDescription")}
        link={{ href: getBookCharactersListPath(book.id), label: t("toCharacters") }}
        title={t("noCharactersTitle")}
      />
    );
  }

  return (
    <PersonGuidedStart book={book} onChoose={onChoose} summary={summary.data ?? null} view={view} />
  );
}

function PersonGuidedStart({
  book,
  onChoose,
  summary,
  view,
}: {
  book: BookView;
  onChoose: (characterId: string) => void;
  summary: Nullable<BookCharacterSummaryView>;
  view: "person" | "tree";
}) {
  const t = useTranslations("relationships.workspace.guided");

  return (
    <section
      aria-labelledby="graph-guided-title"
      className="grid items-center gap-6 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-8 @3xl/workspace:grid-cols-2 @3xl/workspace:gap-10"
    >
      <div className="relative mx-auto w-full max-w-xs @3xl/workspace:max-w-sm">
        <span
          aria-hidden
          className="absolute inset-8 rounded-full bg-accent/45 blur-3xl dark:bg-accent"
        />
        <Image
          alt=""
          aria-hidden
          className="pointer-events-none relative h-auto max-h-64 w-full object-contain select-none"
          height={GUIDED_START.illustration.height}
          sizes={GUIDED_START.illustration.sizes}
          src={GUIDED_START.illustration.src}
          width={GUIDED_START.illustration.width}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4 text-center @3xl/workspace:text-left">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-2xl font-semibold text-ink" id="graph-guided-title">
            {t(view === "tree" ? "treeTitle" : "personTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(view === "tree" ? "treeHint" : "hint")}
          </p>
        </div>
        <h3 className="text-sm font-semibold text-muted-foreground">
          {summary === null
            ? t("charactersTitle")
            : t("charactersCount", { count: summary.totalVisibleCharacters })}
        </h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summary === null
            ? Array.from({ length: GUIDED_START.skeletonCount }, (_, index) => (
                <li key={index}>
                  <Skeleton className="h-32 w-full rounded-2xl" />
                </li>
              ))
            : summary.top.slice(0, GUIDED_START.topLimit).map((character) => (
                <li className="min-w-0" key={character.characterId}>
                  <PersonSuggestion character={character} onChoose={onChoose} />
                </li>
              ))}
        </ul>
        <Button asChild className="self-center @3xl/workspace:self-start" variant="link">
          <Link href={getBookCharactersListPath(book.id)}>{t("toCharacters")}</Link>
        </Button>
      </div>
    </section>
  );
}

function PersonSuggestion({
  character,
  onChoose,
}: {
  character: CharacterSummaryView;
  onChoose: (characterId: string) => void;
}) {
  const t = useTranslations("relationships.workspace.guided");
  const tImportance = useTranslations("characters.importance");
  const name = character.displayName ?? character.name;
  const media = character.portrait ?? character.avatar;

  return (
    <button
      aria-label={t("pick", { name })}
      className="flex h-full w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border border-border bg-background/60 px-2 py-3 text-center transition-colors outline-none hover:border-accent-border hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
      onClick={() => onChoose(character.characterId)}
      type="button"
    >
      <Avatar className="size-16 border-2 border-card shadow-soft ring-1 ring-border">
        {media === null ? null : (
          <AvatarImage alt="" className="object-cover" src={media.urls.thumb} />
        )}
        <AvatarFallback className="font-heading text-xl">
          {name.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="line-clamp-2 w-full text-sm leading-tight font-medium break-words text-ink">
        {name}
      </span>
      <span className="text-xs text-muted-foreground">{tImportance(character.importance)}</span>
    </button>
  );
}
