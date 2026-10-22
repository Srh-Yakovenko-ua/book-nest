"use client";

import type { MouseEvent } from "react";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

import type { RelationshipCreateStep } from "../model/relationship-create-step";

type RelationshipCreateFooterProps = {
  isBookBlocked: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onCancel: () => void;
  step: RelationshipCreateStep;
};

export function RelationshipCreateFooter({
  isBookBlocked,
  isSubmitting,
  onBack,
  onCancel,
  step,
}: RelationshipCreateFooterProps) {
  const t = useTranslations("relationships.editor.actions");

  return (
    <DialogFooter className="shrink-0">
      {step === "edge" ? (
        <>
          <Button
            className="max-sm:min-h-11"
            key="cancel"
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            {t("cancel")}
          </Button>
          <Button className="max-sm:min-h-11" disabled={isBookBlocked} key="next" type="submit">
            {t("next")}
          </Button>
        </>
      ) : (
        <>
          <Button
            className="max-sm:min-h-11"
            disabled={isSubmitting}
            key="back"
            onClick={onBack}
            type="button"
            variant="secondary"
          >
            {t("back")}
          </Button>
          <Button
            className="max-sm:min-h-11"
            disabled={isSubmitting}
            key="create"
            loading={isSubmitting}
            onClick={ignoreRepeatedClick}
            type="submit"
          >
            {t("create")}
          </Button>
        </>
      )}
    </DialogFooter>
  );
}

function ignoreRepeatedClick(event: MouseEvent<HTMLButtonElement>) {
  if (event.detail > 1) event.preventDefault();
}
