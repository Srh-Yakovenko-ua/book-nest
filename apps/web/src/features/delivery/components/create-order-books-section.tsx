"use client";

import type { Currency } from "@app/shared";
import type { Dispatch } from "react";

import { useTranslations } from "next-intl";

import { BookThumb } from "@/components/book-thumb";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type {
  CreateBookOrderDraftAction,
  FinancialMode,
  OrderBookDraft,
} from "../model/create-book-order-draft";

import { FormSection } from "./create-order-form-parts";

export function CreateOrderBooksSection({
  books,
  currency,
  dispatch,
  financialMode,
  onOpenPicker,
}: {
  books: OrderBookDraft[];
  currency: Currency;
  dispatch: Dispatch<CreateBookOrderDraftAction>;
  financialMode: FinancialMode;
  onOpenPicker: () => void;
}) {
  const t = useTranslations("delivery.createOrder");
  return (
    <FormSection description={t("books.description")} icon="book" title={t("books.title")}>
      <div className="flex flex-col gap-3">
        {books.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {books.map((entry) => (
              <li
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 sm:flex-nowrap"
                key={entry.book.id}
              >
                <BookThumb book={entry.book} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{entry.book.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.book.authors.map((author) => author.name).join(", ")}
                  </p>
                </div>
                {financialMode === "items" ? (
                  <div className="order-last ml-12 flex items-center gap-2 sm:order-none sm:ml-0">
                    <Input
                      aria-label={t("books.priceFor", { title: entry.book.title })}
                      aria-required
                      className="h-10 w-20"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) =>
                        dispatch({
                          bookId: entry.book.id,
                          price: event.target.value,
                          type: "bookPriceChanged",
                        })
                      }
                      onKeyDown={blockNegativeNumberKeys}
                      onPaste={blockNegativeNumberPaste}
                      placeholder={t("books.price")}
                      type="number"
                      value={entry.price}
                    />
                    <span className="text-sm text-muted-foreground">{currency}</span>
                  </div>
                ) : null}
                <Button
                  aria-label={t("books.remove", { title: entry.book.title })}
                  onClick={() => dispatch({ bookId: entry.book.id, type: "bookRemoved" })}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="trash" size={16} />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button className="self-start" onClick={onOpenPicker} variant="outline">
          <UiIcon name="plus" size={16} />
          {t("books.add")}
        </Button>
      </div>
    </FormSection>
  );
}
