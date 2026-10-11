"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { OwnSpeciesChange } from "../model/own-species-change";

import { ManageOwnSpeciesDialog } from "./manage-own-species-dialog";

type ManageOwnSpeciesButtonProps = {
  onSpeciesChange: (change: OwnSpeciesChange) => void;
};

export function ManageOwnSpeciesButton({ onSpeciesChange }: ManageOwnSpeciesButtonProps) {
  const t = useTranslations("species.manage");
  const [open, setOpen] = useState(false);

  return (
    <ManageOwnSpeciesDialog
      onChange={onSpeciesChange}
      onOpenChange={setOpen}
      open={open}
      trigger={
        <Button
          className="h-auto self-start p-0 text-muted-foreground hover:text-foreground"
          size="xs"
          type="button"
          variant="link"
        >
          <UiIcon name="settings" size={12} />
          {t("open")}
        </Button>
      }
    />
  );
}
