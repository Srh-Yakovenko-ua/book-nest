"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useVerifyEmail } from "../api/use-verify-email";
import { safeInternalPath } from "../lib/safe-redirect";
import { AuthHeading } from "./auth-heading";
import { FormBanner } from "./form-banner";
import { ResendVerificationForm } from "./resend-verification-form";

type VerifyEmailScreenProps = {
  token: string;
};

const REDIRECT_COUNTDOWN_SECONDS = 5;

type BigIconTone = "destructive" | "neutral" | "success";

const TONE_STYLES = {
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-accent text-primary",
  success: "bg-success-soft text-success",
} as const satisfies Record<BigIconTone, string>;

export function VerifyEmailScreen({ token }: VerifyEmailScreenProps) {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const verify = useVerifyEmail();
  const triggered = useRef(false);

  const hasToken = token.trim() !== "";
  const destination = safeInternalPath(searchParams.get("from")) ?? "/";

  useEffect(() => {
    if (triggered.current) return;
    if (!hasToken) return;
    triggered.current = true;
    verify.mutate({ token });
  }, [hasToken, token, verify]);

  useEffect(() => {
    if (token.length === 0) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [token]);

  if (!hasToken || verify.isError) {
    return (
      <div className="flex flex-col">
        <BigIcon name="alert-triangle" tone="destructive" />
        <AuthHeading title={t("verify.title")} />
        <FormBanner className="mt-6" variant="error">
          {t("errors.invalidToken")}
        </FormBanner>
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-base text-muted-foreground">{t("verify.resendPrompt")}</p>
          <ResendVerificationForm />
        </div>
      </div>
    );
  }

  if (verify.isSuccess) {
    return <VerifyEmailSuccess destination={destination} />;
  }

  return (
    <div className="flex flex-col items-center text-center" role="status">
      <BigIcon name="refresh" spinning tone="neutral" />
      <AuthHeading subtitle={t("verify.subtitle")} title={t("verify.title")} />
      <span className="sr-only">{t("verify.subtitle")}</span>
    </div>
  );
}

function BigIcon({
  name,
  spinning,
  tone,
}: {
  name: UiIconName;
  spinning?: boolean;
  tone: BigIconTone;
}) {
  return (
    <div className={cn("mb-5 grid size-16 place-items-center rounded-full", TONE_STYLES[tone])}>
      <UiIcon
        aria-hidden
        className={spinning === true ? "animate-spin" : undefined}
        name={name}
        size={28}
      />
    </div>
  );
}

function VerifyEmailSuccess({ destination }: { destination: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [seconds, setSeconds] = useState(REDIRECT_COUNTDOWN_SECONDS);
  const navigated = useRef(false);

  const goNow = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    const handle = setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(handle);
  }, []);

  useEffect(() => {
    if (seconds > 0) return;
    goNow();
  }, [seconds, goNow]);

  return (
    <div className="flex flex-col items-center text-center">
      <BigIcon name="check-circle" tone="success" />
      <AuthHeading title={t("verify.success")} />
      <p aria-live="polite" className="mt-2 text-base text-muted-foreground">
        {t("verify.redirecting", { seconds })}
      </p>
      <Button
        className="mt-6 h-12 w-full rounded-md text-base font-semibold"
        onClick={goNow}
        type="button"
      >
        {t("verify.continueNow")}
      </Button>
    </div>
  );
}
