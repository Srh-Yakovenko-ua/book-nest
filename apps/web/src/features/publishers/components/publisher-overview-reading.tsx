import type { PublisherOverviewReadingBook, PublisherOverviewReadingProgress } from "@app/shared";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { PublisherOverviewBookRow } from "./publisher-overview-book-row";
import { PublisherOverviewSection } from "./publisher-overview-section";

type PublisherOverviewReadingProps = {
  books: PublisherOverviewReadingBook[];
};

export function PublisherOverviewReading({ books }: PublisherOverviewReadingProps) {
  const t = useTranslations("publishers.details.overview");

  return (
    <PublisherOverviewSection title={t("sections.reading")}>
      {books.map((book) => (
        <li key={book.id}>
          <PublisherOverviewBookRow book={book}>
            {book.readingStatus === "rereading" ? <RereadingBadge /> : null}
            {book.progress === null ? null : <ReadingProgress progress={book.progress} />}
          </PublisherOverviewBookRow>
        </li>
      ))}
    </PublisherOverviewSection>
  );
}

function ReadingProgress({ progress }: { progress: PublisherOverviewReadingProgress }) {
  const t = useTranslations("publishers.details.overview");
  const { currentPage, pagesCount } = progress;
  const percent = Math.min(100, Math.round((currentPage / pagesCount) * 100));

  return (
    <span className="flex flex-col gap-1">
      <Progress
        aria-label={t("progressAriaLabel", { current: currentPage, total: pagesCount })}
        value={percent}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("progress", { current: currentPage, total: pagesCount })}
      </span>
    </span>
  );
}

function RereadingBadge() {
  const tStatus = useTranslations("books.readingStatus.options");

  return (
    <span>
      <Badge variant="info">{tStatus("rereading")}</Badge>
    </span>
  );
}
