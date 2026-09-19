import type { Nullable } from "@app/shared";
import type { ReactNode, RefObject } from "react";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";

import { assertNever } from "../model/assert-never";
import { NotesContextualSidebarSkeleton } from "./notes-contextual-sidebar";

export type NotesContextualColumn =
  { content: ReactNode; kind: "visible" } | { kind: "hidden" } | { kind: "loading" };

type NotesArchivePageShellProps = {
  archive: ReactNode;
  archiveRef: RefObject<Nullable<HTMLDivElement>>;
  contextual: NotesContextualColumn;
  createLabel: string;
  dialogs: ReactNode;
  onCreate: () => void;
  resultsTitle: string;
  subtitle: string;
  summary: ReactNode;
  title: string;
  toolbar: ReactNode;
};

export function NotesArchivePageShell({
  archive,
  archiveRef,
  contextual,
  createLabel,
  dialogs,
  onCreate,
  resultsTitle,
  subtitle,
  summary,
  title,
  toolbar,
}: NotesArchivePageShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {title}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {subtitle}
          </p>
        </div>
        <Button className="self-start sm:self-auto" onClick={onCreate}>
          <UiIcon name="plus" size={16} />
          {createLabel}
        </Button>
      </header>

      {summary}

      {toolbar}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div
          className="flex min-w-0 flex-1 scroll-mt-[calc(var(--shell-header-height)+1rem)] flex-col gap-6"
          ref={archiveRef}
        >
          <h2 className="sr-only">{resultsTitle}</h2>
          {archive}
        </div>
        <NotesContextualColumnSlot contextual={contextual} />
      </div>

      {dialogs}
    </div>
  );
}

function NotesContextualColumnSlot({ contextual }: { contextual: NotesContextualColumn }) {
  switch (contextual.kind) {
    case "hidden":
      return null;
    case "loading":
      return (
        <div className="hidden min-w-0 xl:block xl:w-[19rem] xl:shrink-0">
          <NotesContextualSidebarSkeleton />
        </div>
      );
    case "visible":
      return <div className="min-w-0 xl:w-[19rem] xl:shrink-0">{contextual.content}</div>;
    default:
      return assertNever(contextual);
  }
}
