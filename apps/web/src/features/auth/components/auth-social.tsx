"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

const OAUTH_PROVIDERS_ENABLED: boolean = false;

export function AuthSocial() {
  const t = useTranslations("auth");

  if (!OAUTH_PROVIDERS_ENABLED) {
    return null;
  }

  return (
    <>
      <div className="my-5 flex items-center gap-3.5 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>{t("common.or")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
        {(["google", "apple"] as const).map((provider) => (
          <button
            aria-label={t("social.continueWith", { provider: t(`social.${provider}`) })}
            className="flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-md border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            key={provider}
            type="button"
          >
            <UiIcon aria-hidden name={provider} size={18} />
            {t(`social.${provider}`)}
          </button>
        ))}
      </div>
    </>
  );
}
