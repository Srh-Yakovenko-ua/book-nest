import { LoanTypeSchema } from "@app/shared";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { LOAN_PAGES } from "@/features/loans";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoansPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { tab, ...rest } = await searchParams;
  const requestedType = LoanTypeSchema.safeParse(tab);
  const pathname = requestedType.success
    ? LOAN_PAGES[requestedType.data].href
    : LOAN_PAGES.borrowed_from_someone.href;

  redirect({ href: { pathname, query: keptParams(rest) }, locale });
}

function keptParams(source: Record<string, string | string[] | undefined>): Record<string, string> {
  const entries = Object.entries(source).flatMap(([key, value]) =>
    typeof value === "string" ? [[key, value] as const] : [],
  );
  return Object.fromEntries(entries);
}
