"use client";

import type { CreateQuoteInput, Nullable, QuoteView, UpdateQuoteInput } from "@app/shared";
import type { Control, FieldErrors } from "react-hook-form";

import { QUOTE_PAGE_MAX } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { BookSelectOption } from "@/features/books/model/book-select-option";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BookSingleSelectPicker } from "@/features/books/components/book-single-select-picker";
import { BookSingleSelectValue } from "@/features/books/components/book-single-select-value";
import {
  BookSelectOptionSchema,
  toBookSelectOption,
} from "@/features/books/model/book-select-option";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import { useCreateQuote, useUpdateQuote } from "../api/use-quote-mutations";

type QuoteDialogProps = (
  | { book: BookSelectOption; mode: "create" }
  | { book: BookSelectOption; mode: "edit"; quote: QuoteView }
  | { mode: "createWithBookPicker" }
) & {
  maxPage?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type QuoteFormValues = {
  book: Nullable<BookSelectOption>;
  chapter: string;
  comment: string;
  isFavorite: boolean;
  isSpoiler: boolean;
  page: string;
  text: string;
};

type QuoteMessages = {
  bookRequired: string;
  chapterMax: string;
  commentMax: string;
  pageMax: string;
  pageMin: string;
  pageWhole: string;
  textMax: string;
  textRequired: string;
};

const QUOTE_BOOK_LABEL_ID = "quote-book-label";
const QUOTE_TEXT_MAX = 1000;
const QUOTE_CHAPTER_MAX = 80;
const QUOTE_COMMENT_MAX = 500;
const QUOTE_PAGE_MIN = 1;

export function QuoteDialog(props: QuoteDialogProps) {
  const { maxPage, onOpenChange, open } = props;
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const book = props.mode === "createWithBookPicker" ? null : props.book;

  function close() {
    setDirty(false);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (!dirty) {
      close();
      return;
    }
    setDiscardOpen(true);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {open ? (
          <>
            <QuoteForm
              book={book}
              maxPage={maxPage}
              onCancel={() => handleOpenChange(false)}
              onDirtyChange={setDirty}
              onDone={close}
              quote={props.mode === "edit" ? props.quote : undefined}
            />
            <DiscardQuoteDialog
              onConfirm={() => {
                setDiscardOpen(false);
                close();
              }}
              onOpenChange={setDiscardOpen}
              open={discardOpen}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload(values: QuoteFormValues) {
  const chapter = values.chapter.trim();
  const comment = values.comment.trim();
  const page = values.page.trim();

  return {
    chapter: chapter.length === 0 ? null : chapter,
    comment: comment.length === 0 ? null : comment,
    isFavorite: values.isFavorite,
    isSpoiler: values.isSpoiler,
    page: page.length === 0 ? null : Number(page),
    text: values.text.trim(),
  } satisfies CreateQuoteInput & UpdateQuoteInput;
}

function buildSchema(messages: QuoteMessages, pageMax: number) {
  const isBlank = (value: string) => value.trim().length === 0;

  return z.object({
    book: BookSelectOptionSchema.nullable().refine((value) => value !== null, {
      message: messages.bookRequired,
    }),
    chapter: z.string().refine((value) => value.trim().length <= QUOTE_CHAPTER_MAX, {
      message: messages.chapterMax,
    }),
    comment: z.string().refine((value) => value.trim().length <= QUOTE_COMMENT_MAX, {
      message: messages.commentMax,
    }),
    isFavorite: z.boolean(),
    isSpoiler: z.boolean(),
    page: z
      .string()
      .refine((value) => isBlank(value) || Number.isInteger(Number(value)), {
        message: messages.pageWhole,
      })
      .refine((value) => isBlank(value) || Number(value) >= QUOTE_PAGE_MIN, {
        message: messages.pageMin,
      })
      .refine((value) => isBlank(value) || Number(value) <= pageMax, { message: messages.pageMax }),
    text: z
      .string()
      .refine((value) => !isBlank(value), { message: messages.textRequired })
      .refine((value) => value.trim().length <= QUOTE_TEXT_MAX, { message: messages.textMax }),
  });
}

function DiscardQuoteDialog({
  onConfirm,
  onOpenChange,
  open,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("quotes.discard");

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuoteBookField({
  control,
  error,
}: {
  control: Control<QuoteFormValues>;
  error: FieldErrors<QuoteFormValues>["book"];
}) {
  const t = useTranslations("quotes.dialog");
  const tPicker = useTranslations("quotes.dialog.bookPicker");

  return (
    <div className="flex flex-col gap-2">
      <Label id={QUOTE_BOOK_LABEL_ID}>
        {t("book")}{" "}
        <span aria-hidden className="text-destructive">
          *
        </span>
      </Label>
      <Controller
        control={control}
        name="book"
        render={({ field }) => (
          <BookSingleSelectPicker
            describedBy={error === undefined ? undefined : "quote-book-error"}
            id="quote-book"
            invalid={error !== undefined}
            labelledBy={QUOTE_BOOK_LABEL_ID}
            labels={{
              change: tPicker("change"),
              collapse: tPicker("collapse"),
              empty: tPicker("empty"),
              loadError: tPicker("loadError"),
              loading: tPicker("loading"),
              results: tPicker("results"),
              resultsCount: (count) => tPicker("resultsCount", { count }),
              search: tPicker("search"),
            }}
            onChange={(nextBook) => field.onChange(toBookSelectOption(nextBook))}
            ref={field.ref}
            required
            value={field.value}
          />
        )}
      />
      <FieldError error={error} id="quote-book-error" />
    </div>
  );
}

function QuoteForm({
  book,
  maxPage,
  onCancel,
  onDirtyChange,
  onDone,
  quote,
}: {
  book: Nullable<BookSelectOption>;
  maxPage?: number;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
  quote?: QuoteView;
}) {
  const t = useTranslations("quotes.dialog");
  const tErrors = useTranslations("quotes.dialog.errors");
  const tActions = useTranslations("quotes.actions");
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const [serverError, setServerError] = useState<null | string>(null);

  const isEdit = quote !== undefined;
  const pending = isEdit ? updateQuote.isPending : createQuote.isPending;
  const pageMax = maxPage ?? QUOTE_PAGE_MAX;

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = useForm<QuoteFormValues>({
    defaultValues: toDefaults(book, quote),
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema(
        {
          bookRequired: tErrors("bookRequired"),
          chapterMax: tErrors("chapterMax", { max: QUOTE_CHAPTER_MAX }),
          commentMax: tErrors("commentMax", { max: QUOTE_COMMENT_MAX }),
          pageMax: tErrors("pageMax", { max: pageMax }),
          pageMin: tErrors("pageMin"),
          pageWhole: tErrors("pageWhole"),
          textMax: tErrors("textMax", { max: QUOTE_TEXT_MAX }),
          textRequired: tErrors("textRequired"),
        },
        pageMax,
      ),
    ),
  });

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const text = useWatch({ control, name: "text" });
  const comment = useWatch({ control, name: "comment" });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const payload = buildPayload(values);
    const onError = () => setServerError(tErrors("generic"));

    if (quote !== undefined) {
      updateQuote.mutate(
        { bookId: quote.bookId, input: payload, quoteId: quote.id },
        {
          onError,
          onSuccess: () => {
            toast.success(t("editSuccess"));
            onDone();
          },
        },
      );
      return;
    }

    if (values.book === null) return;

    createQuote.mutate(
      { bookId: values.book.id, input: payload },
      {
        onError,
        onSuccess: () => {
          toast.success(t("addSuccess"));
          onDone();
        },
      },
    );
  });

  const submitDisabled = text.trim().length === 0 || pending;

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">
          {isEdit ? t("editTitle") : t("addTitle")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEdit ? t("editDescription") : t("addDescription")}
        </DialogDescription>
        <Image
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-3 right-14 hidden select-none sm:block"
          height={64}
          src="/illustrations/leaf-2.png"
          unoptimized
          width={96}
        />
      </DialogHeader>

      {book === null ? (
        <QuoteBookField control={control} error={errors.book} />
      ) : (
        <div aria-labelledby={QUOTE_BOOK_LABEL_ID} className="flex flex-col gap-2" role="group">
          <Label id={QUOTE_BOOK_LABEL_ID}>{t("book")}</Label>
          <BookSingleSelectValue book={book} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="quote-text">
          {t("text")}{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </Label>
        <div className="relative">
          <Textarea
            aria-describedby={errors.text ? "quote-text-error" : undefined}
            aria-invalid={errors.text !== undefined}
            aria-required
            className="min-h-32 pb-7"
            id="quote-text"
            placeholder={t("textPlaceholder")}
            {...register("text")}
          />
          <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground tabular-nums">
            {`${text.length} / ${QUOTE_TEXT_MAX}`}
          </span>
        </div>
        <FieldError error={errors.text} id="quote-text-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="quote-chapter">{t("chapter")}</Label>
          <Input
            aria-describedby={errors.chapter ? "quote-chapter-error" : undefined}
            aria-invalid={errors.chapter !== undefined}
            autoComplete="off"
            className="h-10"
            id="quote-chapter"
            placeholder={t("chapterPlaceholder")}
            {...register("chapter")}
          />
          <FieldError error={errors.chapter} id="quote-chapter-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="quote-page">{t("page")}</Label>
          <Input
            aria-describedby={errors.page ? "quote-page-error" : undefined}
            aria-invalid={errors.page !== undefined}
            className="h-10"
            id="quote-page"
            inputMode="numeric"
            max={pageMax}
            min={QUOTE_PAGE_MIN}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder={t("pagePlaceholder")}
            step="1"
            type="number"
            {...register("page")}
          />
          <FieldError error={errors.page} id="quote-page-error" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="quote-comment">{t("comment")}</Label>
        <div className="relative">
          <Textarea
            aria-describedby={errors.comment ? "quote-comment-error" : undefined}
            aria-invalid={errors.comment !== undefined}
            className="min-h-24 pb-7"
            id="quote-comment"
            placeholder={t("commentPlaceholder")}
            {...register("comment")}
          />
          <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-muted-foreground tabular-nums">
            {`${comment.length} / ${QUOTE_COMMENT_MAX}`}
          </span>
        </div>
        <FieldError error={errors.comment} id="quote-comment-error" />
      </div>

      <div className="flex flex-col gap-4">
        <Controller
          control={control}
          name="isSpoiler"
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Switch
                checked={field.value}
                className="mt-0.5"
                id="quote-is-spoiler"
                onCheckedChange={field.onChange}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="quote-is-spoiler">{t("spoilerToggle")}</Label>
                <p className="text-xs text-muted-foreground">{t("spoilerToggleHelper")}</p>
              </div>
            </div>
          )}
        />

        <Controller
          control={control}
          name="isFavorite"
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Switch
                checked={field.value}
                className="mt-0.5"
                id="quote-is-favorite"
                onCheckedChange={field.onChange}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="quote-is-favorite">{t("favoriteToggle")}</Label>
                <p className="text-xs text-muted-foreground">{t("favoriteToggleHelper")}</p>
              </div>
            </div>
          )}
        />
      </div>

      <p className="flex items-start gap-2.5 rounded-lg bg-accent/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <UiIcon className="mt-px shrink-0 text-icon" name="info" size={14} />
        {t("spoilerNote")}
      </p>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={submitDisabled} loading={pending} type="submit">
          <UiIcon name="sprig" size={16} />
          {isEdit ? t("editSubmit") : t("addSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function toDefaults(book: Nullable<BookSelectOption>, quote?: QuoteView): QuoteFormValues {
  return {
    book,
    chapter: quote?.chapter ?? "",
    comment: quote?.comment ?? "",
    isFavorite: quote?.isFavorite ?? false,
    isSpoiler: quote?.isSpoiler ?? false,
    page: quote?.page == null ? "" : String(quote.page),
    text: quote?.text ?? "",
  };
}
