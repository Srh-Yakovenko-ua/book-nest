"use client";

import type { WishlistBookView } from "@app/shared";
import type { ReactNode } from "react";

import { STORE_LINK_ERROR_CODES } from "@app/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MarkBoughtForm, useMarkOwned, useRemoveFromWishlist } from "@/features/books";
import { ApiError } from "@/lib/http-client";

import { wishlistKeys } from "../api/wishlist-keys";
import { OrderDeliveryForm } from "./order-delivery-form";

const STATUS_OPTIONS = ["bought", "ordered", "received", "dropped"] as const;

type RenderFields = (fields: ReactNode) => ReactNode;

type StatusOption = (typeof STATUS_OPTIONS)[number];

type WishlistStatusDialogProps = {
  book: WishlistBookView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function WishlistStatusDialog({ book, onOpenChange, open }: WishlistStatusDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={focusFirstOption}
      >
        {open ? <WishlistStatusContent book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled wishlist status option: ${String(value)}`);
}

function DirectStatusForm({
  fields,
  isPending,
  onCancel,
  onSubmit,
  serverError,
}: {
  fields: ReactNode;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  serverError: null | string;
}) {
  const t = useTranslations("books.details.ownership.buyConfirm");
  const tActions = useTranslations("books.actions");

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {fields}

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={isPending} loading={isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DropFromWishlistForm({
  bookId,
  onDone,
  renderFields,
}: {
  bookId: string;
  onDone: () => void;
  renderFields: RenderFields;
}) {
  const t = useTranslations("booksToBuy");
  const queryClient = useQueryClient();
  const removeFromWishlist = useRemoveFromWishlist();
  const [serverError, setServerError] = useState<null | string>(null);

  const submit = () => {
    setServerError(null);
    removeFromWishlist.mutate(bookId, {
      onError: (error) => {
        if (error instanceof ApiError && error.code === STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST) {
          void queryClient.invalidateQueries({ queryKey: wishlistKeys.root });
          setServerError(t("removeFromList.notInWishlist"));
          return;
        }
        setServerError(t("removeFromList.error"));
      },
      onSuccess: () => {
        toast.success(t("removeFromList.success"));
        onDone();
      },
    });
  };

  return (
    <DirectStatusForm
      fields={renderFields(null)}
      isPending={removeFromWishlist.isPending}
      onCancel={onDone}
      onSubmit={submit}
      serverError={serverError}
    />
  );
}

function focusFirstOption(event: Event) {
  event.preventDefault();
  if (!(event.currentTarget instanceof HTMLElement)) return;
  event.currentTarget.querySelector<HTMLElement>('[data-slot="radio-group-item"]')?.focus();
}

function MarkOwnedForm({
  bookId,
  onDone,
  renderFields,
}: {
  bookId: string;
  onDone: () => void;
  renderFields: RenderFields;
}) {
  const t = useTranslations("booksToBuy");
  const markOwned = useMarkOwned();
  const [serverError, setServerError] = useState<null | string>(null);

  const submit = () => {
    setServerError(null);
    markOwned.mutate(bookId, {
      onError: () => setServerError(t("markOwnedError")),
      onSuccess: () => {
        toast.success(t("markOwnedSuccess"));
        onDone();
      },
    });
  };

  return (
    <DirectStatusForm
      fields={renderFields(null)}
      isPending={markOwned.isPending}
      onCancel={onDone}
      onSubmit={submit}
      serverError={serverError}
    />
  );
}

function StatusBranch({
  book,
  onDone,
  option,
  renderFields,
}: {
  book: WishlistBookView;
  onDone: () => void;
  option: StatusOption;
  renderFields: RenderFields;
}) {
  const t = useTranslations("booksToBuy");

  switch (option) {
    case "bought":
      return (
        <MarkBoughtForm
          bestOffer={book.bestOffer}
          book={book}
          onDone={onDone}
          onSuccess={() => toast.success(t("markBoughtSuccess"))}
          renderFields={renderFields}
          storeLinks={book.storeLinks}
        />
      );
    case "dropped":
      return <DropFromWishlistForm bookId={book.id} onDone={onDone} renderFields={renderFields} />;
    case "ordered":
      return (
        <OrderDeliveryForm
          bestOffer={book.bestOffer}
          book={book}
          onDone={onDone}
          renderFields={renderFields}
          storeLinks={book.storeLinks}
        />
      );
    case "received":
      return <MarkOwnedForm bookId={book.id} onDone={onDone} renderFields={renderFields} />;
    default:
      return assertNever(option);
  }
}

function toStatusOption(value: string, fallback: StatusOption): StatusOption {
  return STATUS_OPTIONS.find((option) => option === value) ?? fallback;
}

function WishlistStatusContent({ book, onDone }: { book: WishlistBookView; onDone: () => void }) {
  const t = useTranslations("booksToBuy.statusDialog");
  const [option, setOption] = useState<StatusOption>("bought");

  const renderFields: RenderFields = (fields) => (
    <RadioGroup
      aria-label={t("title")}
      className="gap-3"
      onValueChange={(next) => setOption(toStatusOption(next, option))}
      value={option}
    >
      {STATUS_OPTIONS.map((entry) => (
        <div
          className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-accent-border"
          key={entry}
        >
          <label
            className="flex cursor-pointer items-center gap-3"
            htmlFor={`wishlist-status-${entry}`}
          >
            <RadioGroupItem
              aria-describedby={`wishlist-status-${entry}-caption`}
              id={`wishlist-status-${entry}`}
              value={entry}
            />
            <span className="min-w-0 text-sm font-medium text-foreground">
              {t(`${entry}.label`)}
            </span>
          </label>
          <p className="pl-7 text-xs text-muted-foreground" id={`wishlist-status-${entry}-caption`}>
            {t(`${entry}.caption`)}
          </p>
          {option === entry ? <div className="pt-2">{fields}</div> : null}
        </div>
      ))}
    </RadioGroup>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <StatusBranch book={book} onDone={onDone} option={option} renderFields={renderFields} />
    </>
  );
}
