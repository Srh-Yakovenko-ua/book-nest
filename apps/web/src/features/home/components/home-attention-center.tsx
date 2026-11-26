"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";

import type { HomeAttentionCardState, HomeAttentionList } from "../model/home-attention";

import { HomeAttentionRow } from "./home-attention-row";
import { HomeCard } from "./home-card";
import { HomeSectionError } from "./home-section-error";

export type HomeAttentionCenterState = Exclude<HomeAttentionCardState, { kind: "hidden" }>;

type HomeAttentionCenterProps = {
  isRetrying: boolean;
  onRetry: () => void;
  state: HomeAttentionCenterState;
};

const ATTENTION_SKELETON_KEYS = ["first", "second", "third"] as const;

export function HomeAttentionCenter({ isRetrying, onRetry, state }: HomeAttentionCenterProps) {
  const t = useTranslations("home.attention");

  return (
    <HomeCard className="h-full" icon="bell" title={t("title")}>
      <AttentionBody isRetrying={isRetrying} onRetry={onRetry} state={state} />
    </HomeCard>
  );
}

function AttentionBody({ isRetrying, onRetry, state }: HomeAttentionCenterProps) {
  const t = useTranslations("home.attention");
  const tCommon = useTranslations("common");

  switch (state.kind) {
    case "error":
      return (
        <HomeSectionError
          isRetrying={isRetrying}
          onRetry={onRetry}
          retryLabel={t("error.retry")}
          title={t("error.title")}
        />
      );
    case "list":
      return <AttentionList isRetrying={isRetrying} list={state.list} onRetry={onRetry} />;
    case "loading":
      return (
        <div aria-busy className="flex flex-col gap-2">
          <span className="sr-only" role="status">
            {tCommon("loading")}
          </span>
          {ATTENTION_SKELETON_KEYS.map((key) => (
            <div className="flex items-start gap-3 px-2 py-2" key={key}>
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return assertNever(state);
  }
}

function AttentionList({
  isRetrying,
  list,
  onRetry,
}: {
  isRetrying: boolean;
  list: HomeAttentionList;
  onRetry: () => void;
}) {
  const t = useTranslations("home.attention");

  return (
    <div className="flex flex-col gap-2">
      {list.visible.length === 0 ? null : (
        <ul className="-mx-2 flex flex-col gap-0.5">
          {list.visible.map((group) => (
            <HomeAttentionRow group={group} key={group.id} />
          ))}
        </ul>
      )}
      {list.hidden.length === 0 ? null : (
        <Dialog>
          <DialogTrigger asChild>
            <Button className="self-start" size="sm" variant="ghost">
              {t("more", { count: list.hidden.length })}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("moreTitle")}</DialogTitle>
              <DialogDescription>
                {t("moreDescription", { count: list.hidden.length })}
              </DialogDescription>
            </DialogHeader>
            <ul className="-mx-2 flex flex-col gap-0.5">
              {list.hidden.map((group) => (
                <HomeAttentionRow group={group} key={group.id} />
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
      {list.isIncomplete ? (
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          role="status"
        >
          <UiIcon aria-hidden className="shrink-0 text-info" name="info" size={14} />
          <span>{t("incomplete")}</span>
          <Button
            className="h-auto px-1 py-0.5 text-xs"
            loading={isRetrying}
            onClick={onRetry}
            size="sm"
            variant="link"
          >
            {t("error.retry")}
          </Button>
        </p>
      ) : null}
    </div>
  );
}
