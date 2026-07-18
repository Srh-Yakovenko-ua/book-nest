"use client";

import type {
  BookStoreLinkView,
  BookView,
  CreateBookStoreLinkInput,
  Currency,
  UpdateBookStoreLinkInput,
} from "@app/shared";

import { DEFAULT_CURRENCY, MAX_STORE_LINKS_PER_BOOK, STORE_LINK_ERROR_CODES } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { UiIcon } from "@/components/icons";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StoreAutocomplete } from "@/features/books/components/store-autocomplete";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";
import { isHttpsUrl } from "@/lib/is-https-url";

import { useAddStoreLink, useEditStoreLink } from "../api/use-store-links";
import { CURRENCY_LABELS } from "../model/format-store-price";

const CURRENCY_OPTIONS = ["UAH", "USD", "EUR"] as const satisfies readonly Currency[];
const STORE_NAME_MAX = 100;
const STORE_URL_MAX = 300;
const PRICE_MIN = 0;
const PRICE_MAX = 99999999.99;

export type StoreLinkBook = Pick<BookView, "authors" | "cover" | "id" | "publisher" | "title">;

type StoreLinkDialogProps =
  | {
      book: StoreLinkBook;
      link: BookStoreLinkView;
      mode: "edit";
      onOpenChange: (open: boolean) => void;
      open: boolean;
    }
  | {
      book: StoreLinkBook;
      mode: "create";
      onOpenChange: (open: boolean) => void;
      open: boolean;
    };

type StoreLinkMessages = {
  price: string;
  priceMax: string;
  storeNameMax: string;
  storeNameRequired: string;
  url: string;
  urlMax: string;
  urlRequired: string;
};

type StoreLinkValues = {
  currency: Currency;
  price: string;
  storeName: string;
  url: string;
};

export function StoreLinkDialog(props: StoreLinkDialogProps) {
  const { book, onOpenChange, open } = props;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        {open ? (
          <StoreLinkForm
            book={book}
            link={props.mode === "edit" ? props.link : undefined}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload(values: StoreLinkValues) {
  const price = Number(values.price);
  const hasPrice = values.price.trim().length > 0 && Number.isFinite(price);

  return {
    currency: hasPrice ? values.currency : null,
    price: hasPrice ? price : null,
    storeName: values.storeName.trim(),
    url: values.url.trim(),
  } satisfies CreateBookStoreLinkInput & UpdateBookStoreLinkInput;
}

function buildSchema(messages: StoreLinkMessages) {
  return z.object({
    currency: z.enum(CURRENCY_OPTIONS),
    price: z
      .string()
      .refine((value) => value.trim().length === 0 || Number(value) > PRICE_MIN, messages.price)
      .refine(
        (value) => value.trim().length === 0 || Number(value) <= PRICE_MAX,
        messages.priceMax,
      ),
    storeName: z
      .string()
      .refine((value) => value.trim().length > 0, messages.storeNameRequired)
      .refine((value) => value.trim().length <= STORE_NAME_MAX, messages.storeNameMax),
    url: z
      .string()
      .refine((value) => value.trim().length > 0, messages.urlRequired)
      .refine((value) => value.trim().length <= STORE_URL_MAX, messages.urlMax)
      .refine((value) => value.trim().length === 0 || isHttpsUrl(value.trim()), messages.url),
  });
}

function StoreLinkBookPreview({ book }: { book: StoreLinkBook }) {
  const authorNames = book.authors.map((author) => author.name).join(", ");
  const coverSrc = book.cover?.urls.thumb;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
      {coverSrc === undefined ? (
        <div className="grid aspect-[3/4] w-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70">
          <UiIcon name="book" size={18} />
        </div>
      ) : (
        <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-md bg-accent">
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="44px"
            src={coverSrc}
            unoptimized
          />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate font-heading text-sm leading-tight font-bold text-ink">
          {book.title}
        </p>
        {authorNames.length > 0 ? (
          <p className="truncate text-xs text-muted-foreground">{authorNames}</p>
        ) : null}
        {book.publisher === null ? null : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon className="shrink-0" name="building" size={12} />
            <span className="min-w-0 truncate">{book.publisher.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function StoreLinkForm({
  book,
  link,
  onDone,
}: {
  book: StoreLinkBook;
  link?: BookStoreLinkView;
  onDone: () => void;
}) {
  const t = useTranslations("booksToBuy.storeLinkDialog");
  const tErrors = useTranslations("booksToBuy.storeLinkDialog.errors");
  const tActions = useTranslations("books.actions");
  const addLink = useAddStoreLink();
  const editLink = useEditStoreLink();
  const [serverError, setServerError] = useState<null | string>(null);

  const isEdit = link !== undefined;
  const pending = isEdit ? editLink.isPending : addLink.isPending;

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<StoreLinkValues>({
    defaultValues: toDefaults(link),
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        price: tErrors("price"),
        priceMax: tErrors("priceMax", { max: PRICE_MAX }),
        storeNameMax: tErrors("storeNameMax", { max: STORE_NAME_MAX }),
        storeNameRequired: tErrors("storeNameRequired"),
        url: tErrors("url"),
        urlMax: tErrors("urlMax", { max: STORE_URL_MAX }),
        urlRequired: tErrors("urlRequired"),
      }),
    ),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const payload = buildPayload(values);

    const onError = (error: Error) => {
      if (!(error instanceof ApiError)) {
        setServerError(tErrors("generic"));
        return;
      }
      if (error.code === STORE_LINK_ERROR_CODES.DUPLICATE_URL) {
        setServerError(tErrors("duplicateUrl"));
        return;
      }
      if (error.code === STORE_LINK_ERROR_CODES.MAX_LINKS_REACHED) {
        setServerError(tErrors("maxLinks", { max: MAX_STORE_LINKS_PER_BOOK }));
        return;
      }
      setServerError(tErrors("generic"));
    };

    if (link !== undefined) {
      editLink.mutate(
        { bookId: book.id, linkId: link.id, payload },
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

    addLink.mutate(
      { bookId: book.id, payload },
      {
        onError,
        onSuccess: () => {
          toast.success(t("addSuccess"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{isEdit ? t("editTitle") : t("addTitle")}</DialogTitle>
        <DialogDescription>{isEdit ? t("editDescription") : t("addDescription")}</DialogDescription>
      </DialogHeader>

      <StoreLinkBookPreview book={book} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="store-link-store-name">{t("storeName")}</Label>
        <Controller
          control={control}
          name="storeName"
          render={({ field }) => (
            <StoreAutocomplete
              describedBy={errors.storeName ? "store-link-store-name-error" : undefined}
              id="store-link-store-name"
              invalid={errors.storeName !== undefined}
              label={t("storeName")}
              onChange={(next) => field.onChange(next)}
              placeholder={t("storeNamePlaceholder")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.storeName} id="store-link-store-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="store-link-url">{t("url")}</Label>
        <Input
          aria-describedby={errors.url ? "store-link-url-error" : undefined}
          aria-invalid={errors.url !== undefined}
          autoComplete="off"
          className="h-10"
          id="store-link-url"
          inputMode="url"
          placeholder={t("urlPlaceholder")}
          {...register("url")}
        />
        <FieldError error={errors.url} id="store-link-url-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="store-link-price">{t("price")}</Label>
          <Input
            aria-describedby={errors.price ? "store-link-price-error" : undefined}
            aria-invalid={errors.price !== undefined}
            className="h-10"
            id="store-link-price"
            inputMode="decimal"
            min={0}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder="0"
            step="0.01"
            type="number"
            {...register("price")}
          />
          <FieldError error={errors.price} id="store-link-price-error" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="store-link-currency">{t("currency")}</Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <div className="w-full sm:w-28">
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className="h-10 w-full data-[size=default]:h-10"
                    id="store-link-currency"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {CURRENCY_LABELS[currency]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </div>
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={pending} loading={pending} type="submit">
          {isEdit ? t("editSubmit") : t("addSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function toDefaults(link?: BookStoreLinkView): StoreLinkValues {
  return {
    currency: link?.currency ?? DEFAULT_CURRENCY,
    price: link?.price == null ? "" : String(link.price),
    storeName: link?.storeName ?? "",
    url: link?.url ?? "",
  };
}
