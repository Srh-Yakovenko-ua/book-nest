"use client";

import type { LoanContactView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

type LoanContactListRowProps = {
  contact: LoanContactView;
  onOpen: () => void;
};

export function LoanContactListRow({ contact, onOpen }: LoanContactListRowProps) {
  const t = useTranslations("loans.contactsPage.row");
  const tContact = useTranslations("loans.contactDrawer");
  const isArchived = contact.archivedAt !== null;

  return (
    <button
      aria-label={tContact("openContact", { name: contact.name })}
      className="group/contact flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-card transition-colors outline-none hover:border-accent-border hover:bg-secondary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onOpen}
      type="button"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground/70">
        <UiIcon name="user" size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-medium text-ink transition-colors group-hover/contact:text-primary">
            {contact.name}
          </span>
          {isArchived ? <Badge variant="secondary">{tContact("archivedBadge")}</Badge> : null}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {contact.contact ?? tContact("contactEmpty")}
        </span>
      </span>

      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {t("loanCount", { count: contact.loanCount })}
      </span>
    </button>
  );
}
