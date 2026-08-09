"use client";

import type {
  BookView,
  Currency,
  LoanDirection,
  LoanInfoView,
  PurchaseInfoView,
} from "@app/shared";

import { STORE_LINK_ERROR_CODES } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BookStoreLinksBlock, RemoveFromWishlistDialog } from "@/features/books-to-buy";
import { ownershipStatuses } from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

import { useReturnLoan } from "../api/use-loan";
import { useMarkOwned, useRemoveFromWishlist, useRemoveOwned } from "../api/use-ownership";
import { todayIso } from "../model/reading-progress";
import { DeliveryDialog } from "./delivery-dialog";
import { LoanDialog } from "./loan-dialog";
import { MarkBoughtDialog } from "./mark-bought-dialog";
import { WantToBuyDialog } from "./want-to-buy-dialog";

type ActionButton = {
  icon: UiIconName;
  key: string;
  label: string;
  onClick: () => void;
  pending: boolean;
  variant: ButtonVariant;
};

type ButtonVariant = "default" | "ghost" | "secondary";

type DirectMutation = {
  isPending: boolean;
  mutate: (id: string, options: { onError: (error: Error) => void; onSuccess: () => void }) => void;
};

type OwnershipActionLabels = {
  alreadyOwn: string;
  loanBorrowed: string;
  loanLent: string;
  markBought: string;
  markOrdered: string;
  markOwned: string;
  removeFromWishlist: string;
  removeOwned: string;
  return: string;
  startDelivery: string;
  wantToBuy: string;
};

type OwnershipBlockProps = {
  book: BookView;
};

export function OwnershipBlock({ book }: OwnershipBlockProps) {
  const t = useTranslations("books.details.ownership");
  const tOptions = useTranslations("books.ownershipStatus.options");

  const markOwned = useMarkOwned();
  const removeOwned = useRemoveOwned();
  const returnLoan = useReturnLoan();
  const removeFromWishlist = useRemoveFromWishlist();

  const [buyOpen, setBuyOpen] = useState(false);
  const [markBoughtOpen, setMarkBoughtOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [removeFromWishlistOpen, setRemoveFromWishlistOpen] = useState(false);
  const [loanDirection, setLoanDirection] = useState<LoanDirection>("borrowed");

  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);

  function runDirect(mutation: DirectMutation) {
    mutation.mutate(book.id, {
      onError: (error) => toast.error(error instanceof ApiError ? error.message : t("toast.error")),
      onSuccess: () => toast.success(t("toast.updated")),
    });
  }

  function openLoan(direction: LoanDirection) {
    setLoanDirection(direction);
    setLoanOpen(true);
  }

  function confirmRemoveFromWishlist() {
    removeFromWishlist.mutate(book.id, {
      onError: (error) =>
        toast.error(isNotInWishlist(error) ? t("errors.notInWishlist") : t("toast.error")),
      onSuccess: () => {
        setRemoveFromWishlistOpen(false);
        toast.success(t("toast.updated"));
      },
    });
  }

  const actions = buildActions({
    labels: {
      alreadyOwn: t("actions.alreadyOwn"),
      loanBorrowed: t("actions.loanBorrowed"),
      loanLent: t("actions.loanLent"),
      markBought: t("actions.markBought"),
      markOrdered: t("actions.markOrdered"),
      markOwned: t("actions.markOwned"),
      removeFromWishlist: t("actions.removeFromWishlist"),
      removeOwned: t("actions.removeOwned"),
      return: t("actions.return"),
      startDelivery: t("actions.startDelivery"),
      wantToBuy: t("actions.wantToBuy"),
    },
    markOwned,
    onLoan: openLoan,
    onMarkBought: () => setMarkBoughtOpen(true),
    onRemoveFromWishlist: () => setRemoveFromWishlistOpen(true),
    onStartDelivery: () => setDeliveryOpen(true),
    onWantToBuy: () => setBuyOpen(true),
    removeOwned,
    returnLoan,
    runDirect,
    status: book.ownershipStatus,
  });

  return (
    <>
      <Card className="gap-4 shadow-detail-block">
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">{t("statusLabel")}</span>
            {ownershipBase === undefined ? null : (
              <StatusBadge entry={{ ...ownershipBase, label: tOptions(book.ownershipStatus) }} />
            )}
          </div>

          {book.purchaseInfo !== null && book.ownershipStatus === "owned" ? (
            <AcquisitionBlock info={book.purchaseInfo} />
          ) : null}
          <BookStoreLinksBlock book={book} />
          {book.loanInfo === null ? null : <LoanInfoBlock book={book} info={book.loanInfo} />}

          {actions.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              {actions.map((action) => (
                <Button
                  className="w-full"
                  disabled={action.pending}
                  key={action.key}
                  loading={action.pending}
                  onClick={action.onClick}
                  variant={action.variant}
                >
                  <UiIcon name={action.icon} size={16} />
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WantToBuyDialog book={book} onOpenChange={setBuyOpen} open={buyOpen} />
      <MarkBoughtDialog book={book} onOpenChange={setMarkBoughtOpen} open={markBoughtOpen} />
      <DeliveryDialog
        book={book}
        mode="create"
        onOpenChange={setDeliveryOpen}
        open={deliveryOpen}
      />
      <LoanDialog
        book={book}
        direction={loanDirection}
        onOpenChange={setLoanOpen}
        open={loanOpen}
      />
      <RemoveFromWishlistDialog
        isPending={removeFromWishlist.isPending}
        onConfirm={confirmRemoveFromWishlist}
        onOpenChange={setRemoveFromWishlistOpen}
        open={removeFromWishlistOpen}
      />
    </>
  );
}

function AcquisitionBlock({ info }: { info: PurchaseInfoView }) {
  const t = useTranslations("books.details.ownership.purchase");
  const locale = useLocale();

  const priceText = formatPrice(info.expectedPrice, info.currency, locale);
  const hasContent = info.purchasedAt !== null || info.storeName !== null || priceText !== null;
  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
      <p className="text-sm font-medium text-foreground">{t("acquisition")}</p>
      <dl className="flex flex-col gap-2">
        {info.purchasedAt === null ? null : (
          <InfoRow label={t("purchasedAt")} value={formatDate(info.purchasedAt, locale)} />
        )}
        {info.storeName === null ? null : <InfoRow label={t("store")} value={info.storeName} />}
        {priceText === null ? null : <InfoRow label={t("price")} value={priceText} />}
      </dl>
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ownership status: ${String(value)}`);
}

function buildActions({
  labels,
  markOwned,
  onLoan,
  onMarkBought,
  onRemoveFromWishlist,
  onStartDelivery,
  onWantToBuy,
  removeOwned,
  returnLoan,
  runDirect,
  status,
}: {
  labels: OwnershipActionLabels;
  markOwned: DirectMutation;
  onLoan: (direction: LoanDirection) => void;
  onMarkBought: () => void;
  onRemoveFromWishlist: () => void;
  onStartDelivery: () => void;
  onWantToBuy: () => void;
  removeOwned: DirectMutation;
  returnLoan: DirectMutation;
  runDirect: (mutation: DirectMutation) => void;
  status: BookView["ownershipStatus"];
}): ActionButton[] {
  switch (status) {
    case "borrowed_from_someone":
    case "lent_to_someone":
      return [
        {
          icon: "swap",
          key: "return",
          label: labels.return,
          onClick: () => runDirect(returnLoan),
          pending: returnLoan.isPending,
          variant: "default",
        },
      ];
    case "in_transit":
      return [];
    case "none":
      return [
        {
          icon: "check-circle",
          key: "mark-owned",
          label: labels.markOwned,
          onClick: () => runDirect(markOwned),
          pending: markOwned.isPending,
          variant: "default",
        },
        {
          icon: "cart",
          key: "want-to-buy",
          label: labels.wantToBuy,
          onClick: onWantToBuy,
          pending: false,
          variant: "secondary",
        },
        {
          icon: "truck",
          key: "start-delivery",
          label: labels.startDelivery,
          onClick: onStartDelivery,
          pending: false,
          variant: "secondary",
        },
        {
          icon: "arrow-down-circle",
          key: "loan-borrowed",
          label: labels.loanBorrowed,
          onClick: () => onLoan("borrowed"),
          pending: false,
          variant: "secondary",
        },
      ];
    case "owned":
      return [
        {
          icon: "arrow-up-right",
          key: "loan-lent",
          label: labels.loanLent,
          onClick: () => onLoan("lent"),
          pending: false,
          variant: "secondary",
        },
        {
          icon: "x-circle",
          key: "remove-owned",
          label: labels.removeOwned,
          onClick: () => runDirect(removeOwned),
          pending: removeOwned.isPending,
          variant: "ghost",
        },
      ];
    case "want_to_buy":
      return [
        {
          icon: "check-circle",
          key: "mark-bought",
          label: labels.markBought,
          onClick: onMarkBought,
          pending: false,
          variant: "default",
        },
        {
          icon: "truck",
          key: "start-delivery",
          label: labels.markOrdered,
          onClick: onStartDelivery,
          pending: false,
          variant: "secondary",
        },
        {
          icon: "library",
          key: "already-own",
          label: labels.alreadyOwn,
          onClick: () => runDirect(markOwned),
          pending: markOwned.isPending,
          variant: "ghost",
        },
        {
          icon: "x-circle",
          key: "remove-from-wishlist",
          label: labels.removeFromWishlist,
          onClick: onRemoveFromWishlist,
          pending: false,
          variant: "ghost",
        },
      ];
    default:
      return assertNever(status);
  }
}

function formatPrice(
  price: null | number,
  currency: Currency | null,
  locale: string,
): null | string {
  if (price === null) return null;
  const amount = new Intl.NumberFormat(locale).format(price);
  return currency === null ? amount : `${amount} ${currency}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm break-words text-foreground/90">{value}</dd>
    </div>
  );
}

function isNotInWishlist(error: unknown): boolean {
  return error instanceof ApiError && error.code === STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST;
}

function LoanInfoBlock({ book, info }: { book: BookView; info: LoanInfoView }) {
  const t = useTranslations("books.details.loan.info");
  const locale = useLocale();

  const lent = book.ownershipStatus === "lent_to_someone";
  const overdue = info.expectedReturnDate !== null && info.expectedReturnDate < todayIso();

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3.5">
      <p className="text-sm font-medium text-foreground">{t("title")}</p>
      <dl className="flex flex-col gap-2">
        <InfoRow label={lent ? t("lentTo") : t("borrowedFrom")} value={info.personName} />
        {info.loanDate === null ? null : (
          <InfoRow label={t("loanDate")} value={formatDate(info.loanDate, locale)} />
        )}
        {info.expectedReturnDate === null ? null : (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-xs text-muted-foreground">{t("returnDate")}</dt>
            <dd
              className={cn(
                "min-w-0 text-right text-sm tabular-nums",
                overdue ? "font-medium text-destructive" : "text-foreground/90",
              )}
            >
              {formatDate(info.expectedReturnDate, locale)}
              {overdue ? ` · ${t("overdue")}` : ""}
            </dd>
          </div>
        )}
        {info.contact === null ? null : <InfoRow label={t("contact")} value={info.contact} />}
        {info.note === null ? null : <InfoRow label={t("note")} value={info.note} />}
      </dl>
      {info.remindToReturn ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <UiIcon className="shrink-0" name="bell" size={13} />
          {t("reminderOn")}
        </p>
      ) : null}
    </div>
  );
}
