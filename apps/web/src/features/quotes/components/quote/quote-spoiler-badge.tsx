"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export function QuoteSpoilerBadge() {
  const t = useTranslations("quotes.spoiler");

  return (
    <Badge variant="warning">
      <UiIcon name="eye-off" size={12} />
      {t("statusBadge")}
    </Badge>
  );
}
