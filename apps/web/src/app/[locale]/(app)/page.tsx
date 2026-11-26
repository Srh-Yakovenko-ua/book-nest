import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeDashboard } from "@/features/home";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-360 flex-1 px-3 pt-5 pb-12 sm:px-4 md:pt-6 xl:px-6">
      <HomeDashboard />
    </main>
  );
}
