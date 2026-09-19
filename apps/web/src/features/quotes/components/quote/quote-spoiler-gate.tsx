"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { SpoilerGate } from "@/components/spoiler-gate";

export function QuoteSpoilerGate({ action }: { action: ReactNode }) {
  const t = useTranslations("quotes.spoiler");

  return <SpoilerGate action={action} description={t("gateDescription")} title={t("hiddenText")} />;
}
