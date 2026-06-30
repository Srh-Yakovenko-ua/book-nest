import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AUTH_COVER, AuthLayout, ResetPasswordForm } from "@/features/auth";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: Omit<Props, "searchParams">): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "auth.reset" });
  return { referrer: "no-referrer", robots: { index: false }, title: t("title") };
}

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth.reset" });

  return (
    <AuthLayout cover={AUTH_COVER.reset} tagline={t("cover")}>
      <ResetPasswordForm token={token ?? ""} />
    </AuthLayout>
  );
}
