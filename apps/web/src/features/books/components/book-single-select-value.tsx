"use client";

import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";

import type { BookSelectOption } from "../model/book-select-option";

import { BookThumb } from "./book-picker";

type BookSingleSelectValueProps = {
  action?: ReactNode;
  book: BookSelectOption;
  detailsId?: string;
};

export function BookSingleSelectValue({ action, book, detailsId }: BookSingleSelectValueProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <BookThumb book={book} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5" id={detailsId}>
        <span className="truncate text-sm font-medium text-ink">{book.title}</span>
        {book.authorName.length === 0 ? null : (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon className="shrink-0" name="user" size={12} />
            <span className="truncate">{book.authorName}</span>
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
