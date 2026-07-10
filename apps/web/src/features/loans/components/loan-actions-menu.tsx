"use client";

import type { LoanListItemView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

type LoanActionsMenuProps = {
  loan: LoanListItemView;
  onEdit: () => void;
  onReturn: () => void;
};

export function LoanActionsMenu({ loan, onEdit, onReturn }: LoanActionsMenuProps) {
  const t = useTranslations("loans.actions");
  const isBorrowed = loan.type === "borrowed_from_someone";
  const opensDialogRef = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("menu")} data-loan-trigger={loan.id} size="icon" variant="ghost">
          <UiIcon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onCloseAutoFocus={(event) => {
          if (opensDialogRef.current) event.preventDefault();
          opensDialogRef.current = false;
        }}
      >
        <DropdownMenuItem
          onClick={() => {
            opensDialogRef.current = true;
            onReturn();
          }}
        >
          <UiIcon name="check-circle" size={16} />
          {isBorrowed ? t("returnBorrowed") : t("returnLent")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            opensDialogRef.current = true;
            onEdit();
          }}
        >
          <UiIcon name="edit" size={16} />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/books/${loan.book.id}`}>
            <UiIcon name="arrow-right" size={16} />
            {t("goToBook")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
