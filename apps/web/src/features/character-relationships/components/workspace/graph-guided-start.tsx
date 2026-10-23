"use client";

import type { BookView, CharacterSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookCharacterSummary } from "@/features/characters/api/use-book-character-summary";
import { toCharacterBookContext } from "@/features/characters/model/characters-roster-query";
import { Link } from "@/i18n/navigation";

import { getBookCharactersListPath } from "../../model/workspace/graph-workspace-routes";
import { GraphWorkspaceMessage } from "./graph-workspace-message";

const GUIDED_START = {
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
    <section
      aria-labelledby="graph-guided-title"
      className="flex flex-col items-center gap-6 px-4 py-10 text-center"
    >
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="font-heading text-xl font-medium" id="graph-guided-title">
          {t(view === "tree" ? "treeTitle" : "personTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {summary.data === undefined
            ? t("charactersTitle")
            : t("charactersCount", { count: summary.data.totalVisibleCharacters })}
        </h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summary.data === undefined
            ? Array.from({ length: GUIDED_START.skeletonCount }, (_, index) => (
                <li key={index}>
                  <Skeleton className="h-14 w-full rounded-xl" />
                </li>
              ))
            : summary.data.top.slice(0, GUIDED_START.topLimit).map((character) => (
                <li key={character.characterId}>
                  <GuidedCharacterButton character={character} onChoose={onChoose} />
                </li>
              ))}
        </ul>
        <Button asChild className="self-center" variant="link">
          <Link href={getBookCharactersListPath(book.id)}>{t("toCharacters")}</Link>
        </Button>
      </div>
    </section>
  );
}

function GuidedCharacterButton({
  character,
  onChoose,
}: {
  character: CharacterSummaryView;
  onChoose: (characterId: string) => void;
}) {
  const t = useTranslations("relationships.workspace.guided");
  const name = character.displayName ?? character.name;
  const media = character.portrait ?? character.avatar;

  return (
    <Button
      aria-label={t("pick", { name })}
      className="h-14 w-full justify-start gap-3 rounded-xl px-3"
      onClick={() => onChoose(character.characterId)}
      type="button"
      variant="outline"
    >
      <Avatar size="lg">
        {media === null ? null : <AvatarImage alt="" src={media.urls.thumb} />}
        <AvatarFallback>{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <TruncatedText className="text-left" lines={2} text={name} />
    </Button>
  );
}
