import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeDashboard } from "@/features/books";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 pb-16 md:px-8 lg:px-12">
      <HomeDashboard />
    </main>
  );
}
