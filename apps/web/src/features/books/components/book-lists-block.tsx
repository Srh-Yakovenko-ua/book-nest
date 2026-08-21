"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import { BookListMembershipDialog } from "./book-list-membership-dialog";

type BookListsBlockProps = {
  book: BookView;
};

export function BookListsBlock({ book }: BookListsBlockProps) {
  const t = useTranslations("books.details");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card className="gap-4 shadow-detail-block">
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("lists")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {book.lists.length === 0 ? null : (
            <div className="flex flex-wrap gap-2">
              {book.lists.map((list) => (
                <TooltipHint key={list.id} label={list.name}>
                  <Link
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-sm text-foreground/90 transition-colors outline-none hover:border-primary/40 hover:bg-secondary/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    href={`/lists/${list.id}`}
                  >
                    <UiIcon className="shrink-0 text-muted-foreground" name="list" size={14} />
                    <span className="max-w-[12rem] min-w-0 truncate font-medium">{list.name}</span>
                  </Link>
                </TooltipHint>
              ))}
            </div>
          )}

          <Button
            className="self-start"
            onClick={() => setDialogOpen(true)}
            size="sm"
            variant="ghost"
          >
            <UiIcon name="plus" size={16} />
            {t("actions.addToList")}
          </Button>
        </CardContent>
      </Card>

      <BookListMembershipDialog bookId={book.id} onOpenChange={setDialogOpen} open={dialogOpen} />
    </>
  );
}
