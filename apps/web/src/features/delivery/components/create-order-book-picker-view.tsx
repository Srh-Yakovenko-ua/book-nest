"use client";

import type { BookView, OwnershipStatus } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookMultiSelectPicker } from "@/features/books/components/book-multi-select-picker";

const ORDER_PICKER_OWNERSHIP_STATUSES = [
  "none",
  "want_to_buy",
  "in_transit",
] as const satisfies readonly OwnershipStatus[];

export function CreateOrderBookPickerView({
  onBack,
  onCreateBook,
  onDone,
  onSelectedChange,
  selected,
}: {
  onBack: () => void;
  onCreateBook: () => void;
  onDone: () => void;
  onSelectedChange: (books: BookView[]) => void;
  selected: BookView[];
}) {
  const t = useTranslations("delivery.createOrder.bookPicker");
  return (
    <>
      <DialogHeader>
        <Button className="w-fit" onClick={onBack} size="sm" variant="ghost">
          <UiIcon name="arrow-left" size={16} />
          {t("back")}
        </Button>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <BookMultiSelectPicker
        baseParams={{ hasActiveOrder: "false", owner: [...ORDER_PICKER_OWNERSHIP_STATUSES] }}
        labels={{
          clear: t("clear"),
          empty: t("empty"),
          emptySelected: t("emptySelected"),
          library: t("library"),
          loadMore: t("loadMore"),
          removeSelected: t("removeSelected"),
          search: t("search"),
          selected: (count) => t("selected", { count }),
          selectLoaded: (count) => t("selectLoaded", { count }),
        }}
        onSelectedChange={onSelectedChange}
        renderEmpty={(searched) =>
          searched ? (
            t("empty")
          ) : (
            <span className="flex flex-col items-center gap-3 text-center">
              <span className="text-sm font-medium text-ink">{t("noBooks.title")}</span>
              <span className="text-xs text-muted-foreground">{t("noBooks.hint")}</span>
              <Button onClick={onCreateBook} size="sm" variant="secondary">
                <UiIcon name="plus" size={16} />
                {t("noBooks.cta")}
              </Button>
            </span>
          )
        }
        selected={selected}
      />
      <DialogFooter>
        <Button className="sm:min-w-32" onClick={onDone}>
          {t("applySelection")}
        </Button>
      </DialogFooter>
    </>
  );
}
