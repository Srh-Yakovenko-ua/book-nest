"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type RelationshipPartialSaveNoticeProps = {
  isPending: boolean;
  onRetry: () => void;
};

export function RelationshipPartialSaveNotice({
  isPending,
  onRetry,
}: RelationshipPartialSaveNoticeProps) {
  const t = useTranslations("relationships.editor.partialSave");

  return (
    <Alert className="shrink-0">
      <UiIcon name="alert-triangle" size={16} />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{t("description")}</p>
        <Button
          className="max-sm:min-h-11"
          disabled={isPending}
          loading={isPending}
          onClick={onRetry}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
