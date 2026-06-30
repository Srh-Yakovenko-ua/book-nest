"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { AuthHeading } from "./auth-heading";

type EmailSentPanelProps = {
  cooldownSeconds: number;
  hint: string;
  lead: ReactNode;
  onResend: () => void;
  resendPending: boolean;
  title: string;
};

export function EmailSentPanel({
  cooldownSeconds,
  hint,
  lead,
  onResend,
  resendPending,
  title,
}: EmailSentPanelProps) {
  const t = useTranslations("auth");
  const [cooldown, setCooldown] = useState(cooldownSeconds);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const handle = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(handle);
  }, [cooldown]);

  const cooling = cooldown > 0;

  const handleResend = () => {
    if (cooling || resendPending) return;
    onResend();
    setCooldown(cooldownSeconds);
  };

  const resendLabel = cooling ? t("resend.againIn", { seconds: cooldown }) : t("resend.again");

  return (
    <div>
      <span
        aria-hidden
        className="mb-5 grid size-16 place-items-center rounded-full bg-accent text-primary"
      >
        <UiIcon name="mail" size={28} />
      </span>

      <AuthHeading ref={headingRef} subtitle={lead} tabIndex={-1} title={title} />

      <Button
        aria-disabled={cooling || undefined}
        className="h-12 w-full rounded-md text-base font-semibold"
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
