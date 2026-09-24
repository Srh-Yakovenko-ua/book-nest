import type {
  Nullable,
  PublisherOverviewLatestBook,
  PublisherOverviewLatestBookSeries,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

import { PublisherOverviewBookRow } from "./publisher-overview-book-row";
import { PublisherOverviewSection } from "./publisher-overview-section";

type PublisherOverviewLatestProps = {
  book: PublisherOverviewLatestBook;
};

export function PublisherOverviewLatest({ book }: PublisherOverviewLatestProps) {
  const t = useTranslations("publishers.details.overview");
  const tStatus = useTranslations("books.readingStatus.options");
  const locale = useLocale();
  const badge = useLatestBookBadge(book);

  return (
    <PublisherOverviewSection title={t("sections.latest")}>
      <li>
        <PublisherOverviewBookRow book={book}>
          {book.series === null ? null : <LatestBookSeries series={book.series} />}
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{tStatus(book.readingStatus)}</Badge>
            {badge === null ? null : <Badge variant="outline">{badge}</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("addedAt", { date: formatDate(book.createdAt, locale) })}
          </span>
        </PublisherOverviewBookRow>
      </li>
    </PublisherOverviewSection>
  );
}

function LatestBookSeries({ series }: { series: PublisherOverviewLatestBookSeries }) {
  const t = useTranslations("publishers.details.overview");
  const { name, partNumber, totalBooks } = series;

  function label() {
    if (partNumber === null) return name;
    if (totalBooks === null) return t("seriesPart", { name, part: partNumber });
    return t("seriesPartOfTotal", { name, part: partNumber, total: totalBooks });
  }

  return <span className="truncate text-xs text-muted-foreground">{label()}</span>;
}

function useLatestBookBadge(book: PublisherOverviewLatestBook): Nullable<string> {
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tFormat = useTranslations("books.format.options");

  if (book.ownershipStatus !== "none" && book.ownershipStatus !== "owned") {
    return tOwnership(book.ownershipStatus);
  }
  const [format] = book.formats;
  return format === undefined ? null : tFormat(format);
}
