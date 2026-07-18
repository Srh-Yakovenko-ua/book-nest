import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AUTH_COVER, AuthLayout, ResendVerificationForm } from "@/features/auth";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "auth.resend" });
  return { robots: { follow: false, index: false }, title: t("title") };
}

export default async function ResendVerificationPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.resend" });

  return (
    <AuthLayout cover={AUTH_COVER.reset} tagline={t("cover")}>
      <ResendVerificationForm standalone />
    </AuthLayout>
  );
}
