"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { useRouter } from "@/i18n/navigation";

export function LegalBackButton() {
  const t = useTranslations("legal");
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <button
      className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={handleBack}
      type="button"
    >
      <UiIcon name="arrow-left" size={16} />
      {t("back")}
    </button>
  );
}
