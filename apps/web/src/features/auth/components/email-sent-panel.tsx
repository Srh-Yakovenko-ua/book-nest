"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { AuthHeading } from "./auth-heading";

const RESEND_COOLDOWN_SECONDS = 60;

type EmailSentPanelProps = {
  hint: string;
  lead: ReactNode;
  onResend: () => void;
  resendPending: boolean;
  title: string;
};

export function EmailSentPanel({
  hint,
  lead,
  onResend,
  resendPending,
  title,
}: EmailSentPanelProps) {
  const t = useTranslations("auth");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const handle = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(handle);
  }, [cooldown]);

  const handleResend = () => {
    onResend();
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const resendLabel = cooldown > 0 ? t("resend.againIn", { seconds: cooldown }) : t("resend.again");

  return (
    <div>
      <span
        aria-hidden
        className="mb-5 grid size-16 place-items-center rounded-full bg-accent text-primary"
      >
        <UiIcon name="mail" size={28} />
      </span>

      <AuthHeading subtitle={lead} title={title} />

      <Button
        className="h-12 w-full rounded-md text-base font-semibold"
        disabled={resendPending || cooldown > 0}
        loading={resendPending}
        onClick={handleResend}
        type="button"
      >
        {resendPending ? t("common.loading") : resendLabel}
      </Button>

      <p className="mt-5 text-center text-sm text-muted-foreground">{hint}</p>

      <p className="mt-6 text-center text-sm">
        <Link
          className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-primary hover:underline"
          href="/login"
        >
          <UiIcon aria-hidden name="arrow-left" size={16} />
          {t("forgot.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
