"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type RelationshipFamilyCycleNoticeProps = {
  isPending: boolean;
  onConfirm: () => void;
  overridable: boolean;
};

export function RelationshipFamilyCycleNotice({
  isPending,
  onConfirm,
  overridable,
}: RelationshipFamilyCycleNoticeProps) {
  const t = useTranslations("relationships.editor.familyCycle");

  if (!overridable) {
    return (
      <Alert variant="destructive">
        <UiIcon name="alert-triangle" size={16} />
        <AlertTitle>{t("blockedTitle")}</AlertTitle>
        <AlertDescription>{t("blockedDescription")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <UiIcon name="alert-triangle" size={16} />
      <AlertTitle>{t("warningTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{t("warningDescription")}</p>
        <Button
          disabled={isPending}
          loading={isPending}
          onClick={onConfirm}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("confirm")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
