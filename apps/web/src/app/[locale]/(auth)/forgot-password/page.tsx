import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AUTH_COVER, AuthLayout, ForgotPasswordForm } from "@/features/auth";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.forgot" });

  return (
    <AuthLayout cover={AUTH_COVER.reset} tagline={t("cover")}>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "auth.forgot" });
  return { robots: { follow: false, index: false }, title: t("title") };
}
