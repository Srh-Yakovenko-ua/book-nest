"use client";

import type { PostFinishQuotesView } from "@app/shared";

import { differenceInCalendarDays } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { parseIsoDay } from "@/lib/format";

import { useQuotesOverview } from "../api/use-quotes-overview";
import { useReviewPostFinish } from "../api/use-quotes-overview-mutations";
import { useQuotesQuery } from "../model/use-quotes-query";
import { QuoteCover } from "./quote/quote-cover";

const POST_FINISH_REVIEW = {
  navigationDeadlineMs: 1500,
} as const;

type PostFinishQuotesBlockProps = {
  runAction?: (action: () => void) => void;
};

export function PostFinishQuotesBlock({
  runAction = (action) => action(),
}: PostFinishQuotesBlockProps) {
  const { data } = useQuotesOverview();

  if (data === undefined || data.postFinish === null) return null;

  return <PostFinishRecap postFinish={data.postFinish} runAction={runAction} />;
}

function PostFinishRecap({
  postFinish,
  runAction,
}: {
  postFinish: PostFinishQuotesView;
  runAction: (action: () => void) => void;
}) {
  const t = useTranslations("quotes.sidebar.postFinish");
  const tCard = useTranslations("quotes.card");
  const locale = useLocale();
  const review = useReviewPostFinish();
  const { showBookOnly } = useQuotesQuery();
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(deadlineRef.current), []);

  const authorName =
    postFinish.book.firstAuthorName.length === 0
      ? tCard("unknownAuthor")
      : postFinish.book.firstAuthorName;

  const recapDetails = [
    postFinish.favoritesCount > 0
      ? t("favoritesCount", { count: postFinish.favoritesCount })
      : null,
    postFinish.withCommentCount > 0
      ? t("withCommentCount", { count: postFinish.withCommentCount })
      : null,
  ].filter((detail) => detail !== null);

  const reviewThenShowQuotes = () =>
    runAction(() => {
      let navigated = false;
      const showQuotesOnce = () => {
        if (navigated) return;
        navigated = true;
        clearTimeout(deadlineRef.current);
        showBookOnly(postFinish.book.id);
      };

      deadlineRef.current = setTimeout(showQuotesOnce, POST_FINISH_REVIEW.navigationDeadlineMs);

      void review
        .mutateAsync({ readingCycleId: postFinish.readingCycleId })
        .catch(() => undefined)
        .finally(showQuotesOnce);
    });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
        <UiIcon className="text-success" name="check-circle" size={16} />
        {t("title")}
      </h2>

      <div className="flex items-start gap-3">
        <QuoteCover
          alt={tCard("coverAlt", { title: postFinish.book.title })}
          className="aspect-[3/4] w-12 shrink-0"
          iconSize={18}
          sizes="48px"
          src={postFinish.book.cover?.urls.thumb ?? null}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="line-clamp-2 text-sm font-medium text-ink">{postFinish.book.title}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{authorName}</p>
          <p className="text-xs text-muted-foreground">
            {t("finishedAge", { age: relativeDay(postFinish.finishedAt, locale) })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-ink tabular-nums">
          {t("quotesCount", { count: postFinish.quotesCount })}
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
        onClick={reviewThenShowQuotes}
        variant="secondary"
      >
        {t("cta")}
        <UiIcon name="chevron-right" size={16} />
      </Button>
    </section>
  );
}

function relativeDay(isoDay: string, locale: string): string {
  const days = differenceInCalendarDays(parseIsoDay(isoDay), new Date());
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}
