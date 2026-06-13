"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";

import { useVerifyEmail } from "../api/use-verify-email";
import { safeInternalPath } from "../lib/safe-redirect";
import { AuthHeading } from "./auth-heading";
import { FormBanner } from "./form-banner";
import { ResendVerificationForm } from "./resend-verification-form";

type VerifyEmailScreenProps = {
  token: string;
};

const REDIRECT_DELAY_MS = 2000;

export function VerifyEmailScreen({ token }: VerifyEmailScreenProps) {
  const t = useTranslations("auth");
  const router = useRouter();
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

  useEffect(() => {
    if (!verify.isSuccess) return;
    const handle = setTimeout(() => router.replace(destination), REDIRECT_DELAY_MS);
    return () => clearTimeout(handle);
  }, [destination, router, verify.isSuccess]);

  if (!hasToken || verify.isError) {
    return (
      <div className="flex flex-col">
        <BigIcon name="alert-triangle" />
        <AuthHeading title={t("verify.title")} />
        <FormBanner className="mt-6" variant="error">
          {t("errors.invalidToken")}
        </FormBanner>
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-[0.96rem] text-muted-foreground">{t("verify.resendPrompt")}</p>
          <ResendVerificationForm />
        </div>
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <div className="flex flex-col">
        <BigIcon name="check-circle" />
        <AuthHeading title={t("verify.title")} />
        <FormBanner className="mt-6" variant="success">
          {t("verify.success")}
        </FormBanner>
        <Button
          asChild
          className="mt-6 h-[50px] w-full rounded-[10px] text-[0.96rem] font-semibold"
        >
          <Link href={destination}>{t("verify.continue")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <BigIcon name="mail" spinning />
      <AuthHeading subtitle={t("verify.subtitle")} title={t("verify.title")} />
    </div>
  );
}

function BigIcon({ name, spinning }: { name: UiIconName; spinning?: boolean }) {
  return (
    <div className="mb-[18px] grid size-16 place-items-center rounded-full bg-accent text-primary">
      <UiIcon
        aria-hidden
        className={spinning === true ? "animate-pulse" : undefined}
        name={name}
        size={28}
      />
    </div>
  );
}
