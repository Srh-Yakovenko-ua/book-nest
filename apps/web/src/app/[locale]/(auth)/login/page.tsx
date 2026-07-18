import type { Metadata } from "next";

import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AUTH_COVER, AuthLayout, LoginForm } from "@/features/auth";
import { routing } from "@/i18n/routing";
import { buildAlternates, buildOpenGraph, buildTwitter } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "auth.login" });
  const brand = await getTranslations({ locale: resolvedLocale, namespace: "home" });
  const title = brand("title");
  const description = brand("description");

  return {
    alternates: buildAlternates({ locale: resolvedLocale, pathname: "/login" }),
    description,
    openGraph: buildOpenGraph({ description, locale: resolvedLocale, pathname: "/login", title }),
    title: t("title"),
    twitter: buildTwitter({ description, title }),
  };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.login" });

  return (
    <AuthLayout cover={AUTH_COVER.login} tagline={t("cover")}>
      <LoginForm />
    </AuthLayout>
  );
}
