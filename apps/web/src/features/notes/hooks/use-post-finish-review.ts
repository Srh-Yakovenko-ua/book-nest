"use client";

import type { PostFinishNotesView } from "@app/shared";

import { useEffect, useRef } from "react";

import { useReviewNotesPostFinish } from "../api/use-notes-overview-mutations";

export type PostFinishReview = {
  isPending: boolean;
  reviewThenShowNotes: (postFinish: PostFinishNotesView) => void;
};

const POST_FINISH_REVIEW = {
  navigationDeadlineMs: 1500,
} as const;

export function usePostFinishReview(showBookNotes: (bookId: string) => void): PostFinishReview {
  const review = useReviewNotesPostFinish();
  const isActiveRef = useRef(false);
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      clearTimeout(deadlineRef.current);
    };
  }, []);

  const reviewThenShowNotes = (postFinish: PostFinishNotesView) => {
    let isSettled = false;
    const showNotesOnce = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(deadlineRef.current);
      if (isActiveRef.current) showBookNotes(postFinish.book.id);
    };

    clearTimeout(deadlineRef.current);
    deadlineRef.current = setTimeout(showNotesOnce, POST_FINISH_REVIEW.navigationDeadlineMs);

    void review
      .mutateAsync({ readingCycleId: postFinish.readingCycleId })
      .catch(() => undefined)
      .finally(showNotesOnce);
  };

  return { isPending: review.isPending, reviewThenShowNotes };
}
