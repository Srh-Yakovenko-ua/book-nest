import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { canonicalNotesArchiveHref } from "@/features/notes";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NotesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  redirect({ href: canonicalNotesArchiveHref(await searchParams), locale });
}
