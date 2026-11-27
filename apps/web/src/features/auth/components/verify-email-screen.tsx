"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Illustration } from "@/components/illustration";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

import { useVerifyEmail } from "../api/use-verify-email";
import { safeInternalPath } from "../lib/safe-redirect";
import { AuthHeading } from "./auth-heading";
import { FormBanner } from "./form-banner";
import { ResendVerificationForm } from "./resend-verification-form";

type VerifyEmailScreenProps = {
  token: string;
};

const REDIRECT_COUNTDOWN_SECONDS = 5;

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
        <Illustration
          className="mb-5 self-start"
          name="reading-goals/goal-expired-hourglass"
          size="xs"
        />
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
      <BigIcon>
        <Spinner size="lg" />
      </BigIcon>
      <AuthHeading subtitle={t("verify.subtitle")} title={t("verify.title")} />
    </div>
  );
}

function BigIcon({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 grid size-16 place-items-center rounded-full bg-accent text-primary">
      {children}
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
      <div className="flex flex-col items-center" role="status">
        <Illustration className="mb-5" name="email-verified" size="xs" />
        <AuthHeading title={t("verify.success")} />
      </div>
      <p className="mt-2 text-base text-muted-foreground">{t("verify.redirecting", { seconds })}</p>
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
