"use client";

import type { SeriesBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SeriesCharactersContextSelectProps = {
  books: readonly SeriesBookView[];
  onChange: (bookId: string) => void;
  value: string;
};

export function SeriesCharactersContextSelect({
  books,
  onChange,
  value,
}: SeriesCharactersContextSelectProps) {
  const t = useTranslations("series.details.characters.context");
  const labelId = useId();
  const hintId = useId();

  function bookLabel(book: SeriesBookView): string {
    return book.partNumber === null
      ? book.title
      : t("option", { part: book.partNumber, title: book.title });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-sm font-medium text-muted-foreground" id={labelId}>
          {t("label")}
        </span>
        <Select
          onValueChange={(next) => {
            if (next !== value) onChange(next);
          }}
          value={value}
        >
          <SelectTrigger
            aria-describedby={hintId}
            aria-labelledby={labelId}
            className="w-full min-w-0 sm:max-w-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {books.map((book) => (
              <SelectItem key={book.id} value={book.id}>
                {bookLabel(book)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground" id={hintId}>
        {t("hint")}
      </p>
    </div>
  );
}
