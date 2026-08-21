"use client";

import type { CancelledFollowUpView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWantToBuy } from "@/features/books/api/use-ownership";
import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";

import type { CancelledDecisionRow } from "../model/cancelled-follow-up";

import { useReturnAllToWishlist } from "../api/use-cancelled-follow-up";
import { buildCancelledDecisionRows } from "../model/cancelled-follow-up";
import { DeliveryBookMetaLink } from "./delivery-book-preview";

type DeliveryCancelledDecisionBlockProps = {
  isLoading: boolean;
  unresolved: Nullable<CancelledFollowUpView["unresolved"]>;
};

const BULK_ACTION_FROM_BOOKS = 2;

export function DeliveryCancelledDecisionBlock({
  isLoading,
  unresolved,
}: DeliveryCancelledDecisionBlockProps) {
  const t = useTranslations("delivery.history.cancelledDecision");
  const tToast = useTranslations("delivery.toast");
  const locale = useLocale();
  const wantToBuy = useWantToBuy();
  const returnAll = useReturnAllToWishlist();

  if (isLoading) {
    return (
      <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
        <div aria-busy className="flex flex-col gap-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      </LibraryOverviewSection>
    );
  }

  if (unresolved === null) {
    return null;
  }

  const rows = buildCancelledDecisionRows({
    books: unresolved.books,
    cancelledOn: (date) => t("cancelledOn", { date }),
    locale,
  });

  function returnOne(row: CancelledDecisionRow) {
    wantToBuy.mutate(
      { id: row.id, payload: {} },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: () => toast.success(t("toast.returned", { title: row.title })),
      },
    );
  }

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg leading-tight font-semibold text-ink">
            {t("booksCount", { count: unresolved.booksCount })}
          </p>
          <p className="text-xs text-muted-foreground">{t("helper")}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li className="flex flex-col gap-1" key={row.id}>
              <DeliveryBookMetaLink
                book={row}
                meta={
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {row.cancelReason === null
                      ? row.cancelledOnText
                      : t("cancelledWithReason", {
                          date: row.cancelledOnText,
                          reason: row.cancelReason,
                        })}
                  </span>
                }
              />
              <Button
                className="h-7 justify-start gap-1.5 px-2 text-xs"
                disabled={returnAll.isPending}
                loading={wantToBuy.isPending && wantToBuy.variables?.id === row.id}
                onClick={() => returnOne(row)}
                size="sm"
                variant="ghost"
              >
                <UiIcon aria-hidden name="cart" size={14} />
                {t("action")}
              </Button>
            </li>
          ))}
        </ul>

        {unresolved.booksCount < BULK_ACTION_FROM_BOOKS ? null : (
          <Button
            className="w-full"
            disabled={wantToBuy.isPending}
            loading={returnAll.isPending}
            onClick={() =>
              returnAll.mutate(undefined, {
                onError: () => toast.error(tToast("error")),
                onSuccess: (result) =>
                  toast.success(t("toast.returnedAll", { count: result.updatedCount })),
              })
            }
            size="sm"
            variant="secondary"
          >
            <UiIcon aria-hidden name="cart" size={16} />
            {t("bulkAction")}
          </Button>
        )}
      </div>
    </LibraryOverviewSection>
  );
}
