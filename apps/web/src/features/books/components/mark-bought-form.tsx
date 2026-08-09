"use client";

import type {
  BestOfferView,
  BookStoreLinkView,
  BookView,
  MarkBoughtInput,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { STORE_LINK_ERROR_CODES } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { isAfter, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { wishlistKeys } from "@/features/books-to-buy/api/wishlist-keys";
import { findBestOfferLinkId } from "@/features/books-to-buy/model/best-offer-link";
import { ApiError } from "@/lib/http-client";

import { useMarkBought } from "../api/use-ownership";
import { todayIso } from "../model/reading-progress";
import {
  buildStoreSourceSchema,
  resolveStoreName,
  resolveStorePrice,
  STORE_SOURCE_LIMITS,
  type StoreSourceValue,
  toStoreSourceDefaults,
} from "../model/store-source";
import { BookDateField } from "./book-date-field";
import { StoreSourceFields } from "./store-source-fields";

type MarkBoughtFormProps = {
  bestOffer: Nullable<BestOfferView>;
  book: BookView;
  onDone: () => void;
  onSuccess?: () => void;
  renderFields?: (fields: ReactNode) => ReactNode;
  storeLinks: BookStoreLinkView[];
};

type MarkBoughtValues = {
  purchasedAt: string;
  store: StoreSourceValue;
};

export function MarkBoughtForm({
  bestOffer,
  book,
  onDone,
  onSuccess,
  renderFields = (fields) => fields,
  storeLinks,
}: MarkBoughtFormProps) {
  const t = useTranslations("books.details.ownership.buyConfirm");
  const tErrors = useTranslations("books.details.ownership.errors");
  const tActions = useTranslations("books.actions");
  const queryClient = useQueryClient();
  const markBought = useMarkBought();
  const [serverError, setServerError] = useState<null | string>(null);
  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<MarkBoughtValues>({
    defaultValues: {
      purchasedAt: todayIso(),
      store: toStoreSourceDefaults({ bestOffer, purchaseInfo: book.purchaseInfo, storeLinks }),
    },
    mode: "onTouched",
    resolver: zodResolver(
      z.object({
        purchasedAt: z
          .string()
          .refine((value) => value.length > 0, tErrors("purchaseDateRequired"))
          .refine(
            (value) => value.length === 0 || !isAfter(parseISO(value), new Date()),
            tErrors("purchaseDateFuture"),
          ),
        store: buildStoreSourceSchema({
          price: tErrors("price"),
          priceMax: tErrors("priceMax"),
          storeNameMax: tErrors("storeNameMax", { max: STORE_SOURCE_LIMITS.storeNameMax }),
        }),
      }),
    ),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    markBought.mutate(
      { id: book.id, payload: buildPayload({ storeLinks, values }) },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.code === STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST) {
            void queryClient.invalidateQueries({ queryKey: wishlistKeys.root });
            setServerError(tErrors("notInWishlist"));
            return;
          }
          setServerError(error instanceof ApiError ? error.message : tErrors("generic"));
        },
        onSuccess: () => {
          onSuccess?.();
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      {renderFields(
        <div className="flex flex-col gap-5">
          <Controller
            control={control}
            name="store"
            render={({ field }) => (
              <StoreSourceFields
                bestOfferLinkId={bestOfferLinkId}
                errors={{ price: errors.store?.price, storeName: errors.store?.storeName }}
                onBlur={field.onBlur}
                onChange={field.onChange}
                purchaseInfo={book.purchaseInfo}
                storeLinks={storeLinks}
                value={field.value}
              />
            )}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="mark-bought-date">{t("date")}</Label>
            <Controller
              control={control}
              name="purchasedAt"
              render={({ field }) => (
                <BookDateField
                  ariaLabel={t("date")}
                  describedBy={errors.purchasedAt ? "mark-bought-date-error" : undefined}
                  id="mark-bought-date"
                  invalid={errors.purchasedAt !== undefined}
                  onChange={(next) => field.onChange(next ?? "")}
                  value={field.value}
                />
              )}
            />
            <FieldError error={errors.purchasedAt} id="mark-bought-date-error" />
          </div>
        </div>,
      )}

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={markBought.isPending} loading={markBought.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function buildPayload({
  storeLinks,
  values,
}: {
  storeLinks: BookStoreLinkView[];
  values: MarkBoughtValues;
}): MarkBoughtInput {
  const payload: MarkBoughtInput = {
    currency: values.store.currency,
    purchasedAt: values.purchasedAt,
  };
  const storeName = resolveStoreName({ storeLinks, value: values.store });
  const price = resolveStorePrice(values.store);

  if (storeName.length > 0) payload.storeName = storeName;
  if (price !== null) payload.expectedPrice = price;

  return payload;
}
