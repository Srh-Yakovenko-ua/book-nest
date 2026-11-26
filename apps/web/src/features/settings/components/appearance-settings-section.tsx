"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { LanguageRow } from "./language-row";
import { ThemeRow } from "./theme-row";

export function AppearanceSettingsSection() {
  const t = useTranslations("settings.appearance");

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ThemeRow />
        <LanguageRow />
      </CardContent>
    </Card>
  );
}
