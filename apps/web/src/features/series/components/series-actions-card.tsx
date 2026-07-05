"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SeriesActionsCardProps = {
  onAddBook: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function SeriesActionsCard({ onAddBook, onDelete, onEdit }: SeriesActionsCardProps) {
  const t = useTranslations("series.details.actions");

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button className="justify-start" onClick={onEdit} variant="secondary">
          <UiIcon name="edit" size={16} />
          {t("edit")}
        </Button>
        <Button className="justify-start" onClick={onAddBook} variant="secondary">
          <UiIcon name="plus" size={16} />
          {t("addBook")}
        </Button>
        <Button className="justify-start text-destructive" onClick={onDelete} variant="ghost">
          <UiIcon name="trash" size={16} />
          {t("delete")}
        </Button>
      </CardContent>
    </Card>
  );
}
