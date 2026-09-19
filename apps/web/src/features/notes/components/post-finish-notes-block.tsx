"use client";

import type { PostFinishNotesView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { PostFinishReview } from "../hooks/use-post-finish-review";

import { relativeDayFromToday } from "../model/note-dates";
import { BookNoteEntityHeader } from "./book-note-entity-header";

type PostFinishNotesBlockProps = {
  postFinish: PostFinishNotesView;
  review: PostFinishReview;
  runAction: (action: () => void) => void;
};

export function PostFinishNotesBlock({ postFinish, review, runAction }: PostFinishNotesBlockProps) {
  const t = useTranslations("notes.overview.postFinish");
  const locale = useLocale();
  const titleId = useId();

  const recapDetails = [
    postFinish.favoritesCount > 0
      ? t("favoritesCount", { count: postFinish.favoritesCount })
      : null,
    postFinish.pinnedCount > 0 ? t("pinnedCount", { count: postFinish.pinnedCount }) : null,
  ].filter((detail) => detail !== null);

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <h2
        className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink"
        id={titleId}
      >
        <UiIcon aria-hidden className="text-success" name="check-circle" size={16} />
        {t("title")}
      </h2>

      <BookNoteEntityHeader book={postFinish.book} placement="card" />

      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          {t("finishedAge", { age: relativeDayFromToday(postFinish.finishedAt, locale) })}
        </p>
        <p className="text-sm font-semibold text-ink tabular-nums">
          {t("notesCount", { count: postFinish.notesCount })}
        </p>
        {recapDetails.length === 0 ? null : (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {recapDetails.map((detail, index) => (
              <Fragment key={detail}>
                {index === 0 ? null : <span aria-hidden="true">·</span>}
                <span>{detail}</span>
              </Fragment>
            ))}
          </p>
        )}
      </div>

      <Button
        className="justify-between"
        loading={review.isPending}
        onClick={() => runAction(() => review.reviewThenShowNotes(postFinish))}
        variant="secondary"
      >
        {t("cta")}
        <UiIcon aria-hidden name="chevron-right" size={16} />
      </Button>
    </section>
  );
}
