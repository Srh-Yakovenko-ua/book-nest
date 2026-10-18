"use client";

import type { CustomListCard, Nullable, ReadingGoalView } from "@app/shared";
import type { RefObject } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLists } from "@/features/lists/api/use-lists";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import type { GoalListChoice } from "../model/goal-list-choice";
import type { GoalListPickerContent } from "../model/goal-list-picker-content";

import { listGoalQueryOptions } from "../api/use-list-goal";
import { resolveGoalListChoice } from "../model/goal-list-choice";
import {
  goalListPickerParams,
  resolveGoalListPickerContent,
} from "../model/goal-list-picker-content";

const GOAL_LIST_PICKER = {
  searchMaxLength: 100,
  skeletonCount: 4,
} as const;

type GoalListPickerProps = {
  onChoose: (choice: GoalListChoice) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
};

export function GoalListPicker({ onChoose, onOpenChange, open, openerRef }: GoalListPickerProps) {
  const t = useTranslations("goals.picker");
  const queryClient = useQueryClient();
  const [pendingListId, setPendingListId] = useState<Nullable<string>>(null);

  async function choose(list: CustomListCard) {
    if (pendingListId !== null) return;
    setPendingListId(list.id);

    let goal: Nullable<ReadingGoalView>;
    try {
      goal = await queryClient.fetchQuery({ ...listGoalQueryOptions(list.id), staleTime: 0 });
    } catch {
      setPendingListId(null);
      toast.error(t("lookupError"));
      return;
    }

    setPendingListId(null);
    onChoose(resolveGoalListChoice({ goal, list }));
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (pendingListId !== null) return;
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <PickerBody onChoose={(list) => void choose(list)} pendingListId={pendingListId} />
      </DialogContent>
    </Dialog>
  );
}

function ListOption({
  list,
  onChoose,
  pendingListId,
}: {
  list: CustomListCard;
  onChoose: (list: CustomListCard) => void;
  pendingListId: Nullable<string>;
}) {
  const t = useTranslations("goals.picker");
  const isPending = pendingListId === list.id;
  const isBlocked = pendingListId !== null && !isPending;

  return (
    <li>
      <button
        aria-busy={isPending}
        aria-disabled={pendingListId !== null}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-accent-border hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-disabled:cursor-wait",
          isPending && "border-primary bg-secondary/40",
          isBlocked && "opacity-60",
        )}
        onClick={() => onChoose(list)}
        type="button"
      >
        <UiIcon aria-hidden className="shrink-0 text-primary/70" name="list" size={18} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium break-words text-ink">{list.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("bookCount", { count: list.bookCount })}
          </span>
        </span>
        {isPending ? (
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <UiIcon
            aria-hidden
            className="shrink-0 text-muted-foreground"
            name="chevron-right"
            size={16}
          />
        )}
      </button>
    </li>
  );
}

function PickerBody({
  onChoose,
  pendingListId,
}: {
  onChoose: (list: CustomListCard) => void;
  pendingListId: Nullable<string>;
}) {
  const t = useTranslations("goals.picker");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const lists = useLists(goalListPickerParams(search));

  const content = resolveGoalListPickerContent({
    hasNextPage: lists.hasNextPage,
    isError: lists.isError,
    isFetchingNextPage: lists.isFetchingNextPage,
    isFetchNextPageError: lists.isFetchNextPageError,
    isPending: lists.isPending,
    lists: lists.data?.pages.flatMap((page) => page.items) ?? [],
    search,
  });

  function loadNextPage() {
    if (!lists.hasNextPage || lists.isFetchingNextPage) return;
    void lists.fetchNextPage();
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {content.kind === "no-lists" ? null : (
        <DebouncedSearchInput
          clearLabel={tCommon("clear")}
          label={t("search")}
          maxLength={GOAL_LIST_PICKER.searchMaxLength}
          onClear={() => setSearch("")}
          onSearch={setSearch}
          placeholder={t("searchPlaceholder")}
          value={search}
        />
      )}
      <p className="sr-only" role="status">
        {pendingListId === null ? "" : t("checking")}
      </p>
      <div
        aria-busy={lists.isPlaceholderData}
        className="-mx-2 max-h-[min(24rem,55dvh)] overflow-y-auto overscroll-contain px-2"
      >
        <PickerResults
          content={content}
          onChoose={onChoose}
          onLoadMore={loadNextPage}
          onRetry={() => void lists.refetch()}
          pendingListId={pendingListId}
        />
      </div>
    </div>
  );
}

function PickerResults({
  content,
  onChoose,
  onLoadMore,
  onRetry,
  pendingListId,
}: {
  content: GoalListPickerContent;
  onChoose: (list: CustomListCard) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  pendingListId: Nullable<string>;
}) {
  const t = useTranslations("goals.picker");

  switch (content.kind) {
    case "error":
      return (
        <div className="flex flex-col items-center gap-3 px-3 py-6 text-center" role="alert">
          <p className="text-sm text-error">{t("loadError")}</p>
          <Button onClick={onRetry} size="sm" variant="secondary">
            <UiIcon name="refresh" size={14} />
            {t("retry")}
          </Button>
        </div>
      );
    case "lists":
      return (
        <>
          <ul aria-label={t("results")} className="flex flex-col gap-1">
            {content.lists.map((list) => (
              <ListOption
                key={list.id}
                list={list}
                onChoose={onChoose}
                pendingListId={pendingListId}
              />
            ))}
          </ul>
          <InfiniteScrollFooter
            errorLabel={t("loadMoreError")}
            onLoadMore={onLoadMore}
            state={content.footer}
          />
        </>
      );
    case "loading":
      return (
        <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-1">
          {Array.from({ length: GOAL_LIST_PICKER.skeletonCount }, (_, index) => (
            <div className="flex items-center gap-3 px-3 py-2.5" key={index}>
              <Skeleton className="size-4.5 shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/3 rounded-md" />
                <Skeleton className="h-3 w-1/4 rounded-md" />
              </div>
            </div>
          ))}
        </output>
      );
    case "no-lists":
      return (
        <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
          <p className="font-heading text-sm font-medium text-ink">{t("emptyTitle")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("emptyDescription")}</p>
          <Button asChild variant="secondary">
            <Link href="/lists">
              <UiIcon name="list" size={16} />
              {t("toLists")}
            </Link>
          </Button>
        </div>
      );
    case "no-matches":
      return (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
          {t("noMatches")}
        </p>
      );
    default:
      return assertNever(content);
  }
}
