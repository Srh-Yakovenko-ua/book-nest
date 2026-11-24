"use client";

import type { NoteView } from "@app/shared";

import { useState } from "react";

import {
  NoteFullViewDialog,
  useNoteFullView,
  useNoteRediscoveryImpressions,
  useNoteToggles,
  useRecordImpressionWhenVisible,
} from "@/features/notes";
import { cn } from "@/lib/utils";

import type { HomeNoteMemory } from "../model/home-memory";

import { HomeMemoryBookLine, HomeMemoryFooter } from "./home-memory-details";
import { HomeMemoryFavoriteToggle } from "./home-memory-favorite-toggle";
import { HomeMemoryFrame } from "./home-memory-frame";
import { HomeMemorySpoiler } from "./home-memory-spoiler";

export function HomeMemoryNote({ memory }: { memory: HomeNoteMemory }) {
  const { note, source } = memory;
  const [isRevealed, setRevealed] = useState(false);
  const toggles = useNoteToggles(note);
  const fullView = useNoteFullView();
  const recordImpression = useNoteRediscoveryImpressions();
  const isHidden = note.isSpoiler && !isRevealed;

  return (
    <HomeMemoryFrame
      action={
        isHidden ? null : (
          <HomeMemoryFavoriteToggle
            isFavorite={note.isFavorite}
            isPending={toggles.isPending}
            onToggle={toggles.toggleFavorite}
          />
        )
      }
    >
      {isHidden ? (
        <HomeMemorySpoiler onReveal={() => setRevealed(true)} />
      ) : (
        <NoteMemoryText
          impressionKey={memory.impressionKey}
          note={note}
          recordImpression={recordImpression}
        />
      )}

      <HomeMemoryBookLine
        authors={source.authors.map((author) => author.name).join(", ")}
        bookId={source.id}
        bookTitle={source.title}
        chapter={isHidden ? null : note.chapter}
        page={isHidden ? null : note.page}
      />

      <HomeMemoryFooter
        createdAt={note.createdAt}
        onOpenFull={isHidden ? null : fullView.openFrom}
      />

      <NoteFullViewDialog
        note={note}
        onOpenChange={fullView.onOpenChange}
        open={fullView.isOpen}
        triggerRef={fullView.triggerRef}
      />
    </HomeMemoryFrame>
  );
}

function NoteMemoryText({
  impressionKey,
  note,
  recordImpression,
}: {
  impressionKey: string;
  note: NoteView;
  recordImpression: (impressionKey: string) => void;
}) {
  const textRef = useRecordImpressionWhenVisible<HTMLDivElement>({
    impressionKey,
    recordImpression,
  });
  const title = note.title?.trim() ?? "";

  return (
    <div className="flex min-w-0 flex-col gap-1.5" ref={textRef}>
      {title.length === 0 ? null : (
        <h3 className="line-clamp-2 font-heading text-base leading-snug font-semibold wrap-anywhere text-ink">
          {title}
        </h3>
      )}
      <p
        className={cn(
          "text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground",
          title.length === 0 ? "line-clamp-4" : "line-clamp-3",
        )}
      >
        {note.text}
      </p>
    </div>
  );
}
