"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";

import type { HomeMemorySelection } from "../model/home-memory";

import { HomeMemoryFrame } from "./home-memory-frame";
import { HomeMemoryNote } from "./home-memory-note";
import { HomeMemoryQuote } from "./home-memory-quote";

export type HomeBookMemoryState = Exclude<HomeMemorySelection, { kind: "hidden" }>;

type HomeBookMemoryProps = {
  isRetrying: boolean;
  onRetry: () => void;
  selection: HomeBookMemoryState;
};

export function HomeBookMemory({ isRetrying, onRetry, selection }: HomeBookMemoryProps) {
  switch (selection.kind) {
    case "error":
      return <MemoryError isRetrying={isRetrying} onRetry={onRetry} />;
    case "loading":
      return <MemorySkeleton />;
    case "note":
      return <HomeMemoryNote key={selection.memory.impressionKey} memory={selection.memory} />;
    case "quote":
      return <HomeMemoryQuote key={selection.quote.id} quote={selection.quote} />;
    default:
      return assertNever(selection);
  }
}

function MemoryError({ isRetrying, onRetry }: { isRetrying: boolean; onRetry: () => void }) {
  const t = useTranslations("home.memory.error");

  return (
    <HomeMemoryFrame>
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <UiIcon
            aria-hidden
            className="mt-0.5 shrink-0 text-warning"
            name="alert-circle"
            size={16}
          />
          {t("title")}
        </p>
        <Button loading={isRetrying} onClick={onRetry} size="sm" variant="secondary">
          <UiIcon aria-hidden name="refresh" size={14} />
          {t("retry")}
        </Button>
      </div>
    </HomeMemoryFrame>
  );
}

function MemorySkeleton() {
  const tCommon = useTranslations("common");

  return (
    <HomeMemoryFrame>
      <div aria-busy className="flex flex-col gap-2">
        <span className="sr-only" role="status">
          {tCommon("loading")}
        </span>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-9/12" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
    </HomeMemoryFrame>
  );
}
