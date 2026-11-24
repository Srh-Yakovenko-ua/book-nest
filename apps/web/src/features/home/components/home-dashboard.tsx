"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth";
import { useLibraryOverview } from "@/features/books";
import { useNotesOverview } from "@/features/notes";
import { useQuotesOverview } from "@/features/quotes";
import { Link } from "@/i18n/navigation";

import type { HomeDashboardContent } from "./home-dashboard-layout";

import { useHomeAttention } from "../api/use-home-attention";
import { useHomeNextRead } from "../api/use-home-next-read";
import { useHomeReading } from "../api/use-home-reading";
import { useHomeCalendar } from "../hooks/use-home-calendar";
import {
  homeAttentionCardState,
  homeAttentionPresence,
  homeCriticalBanner,
} from "../model/home-attention";
import { homeDisplayName, homeGreetingTone, homeSubtitleKey } from "../model/home-greeting";
import { HOME_LIBRARY_LINKS } from "../model/home-library-links";
import {
  bookMemoryNote,
  homeMemoryPresence,
  memorySourceFromQuery,
  quoteMemory,
  selectHomeMemory,
} from "../model/home-memory";
import { homeNextReadState, isQueueConfirmedEmpty } from "../model/home-next-read";
import { isConfirmedEmptyHome } from "../model/home-onboarding";
import { homeReadingFacts, homeReadingWidget } from "../model/home-reading";
import { homeRecentShelf } from "../model/home-recent-books";
import { homeSummaryState } from "../model/home-summary";
import { HomeAttentionCenter } from "./home-attention-center";
import { HomeBookMemory } from "./home-book-memory";
import { HomeCriticalBanner } from "./home-critical-banner";
import { HomeCurrentlyReading } from "./home-currently-reading";
import { HomeDashboardLayout } from "./home-dashboard-layout";
import { HomeLibrarySummaryStrip } from "./home-library-summary-strip";
import { HomeNextRead } from "./home-next-read";
import { HomeOnboarding } from "./home-onboarding";
import { HomeReadingGoal } from "./home-reading-goal";
import { HomeReadingWeek } from "./home-reading-week";
import { HomeRecentBooks } from "./home-recent-books";
import { HomeWelcomeSection } from "./home-welcome-section";

export function HomeDashboard() {
  const t = useTranslations("home");
  const calendar = useHomeCalendar();
  const user = useAuthStore((state) => state.user);
  const overview = useLibraryOverview("all");
  const quotes = useQuotesOverview();
  const notes = useNotesOverview({ scope: "books" });
  const reading = useHomeReading();
  const nextRead = useHomeNextRead();
  const attention = useHomeAttention();

  const memory = selectHomeMemory({
    note: memorySourceFromQuery({ pick: bookMemoryNote, query: notes }),
    quote: memorySourceFromQuery({ pick: quoteMemory, query: quotes }),
    today: calendar.today,
  });
  const recentShelf = homeRecentShelf({
    query: overview,
    timeZone: calendar.timeZone,
    today: calendar.today,
  });
  const libraryTotal = overview.data?.summary.total ?? null;
  const readingFacts = homeReadingFacts(reading.data);
  const isOnboarding = isConfirmedEmptyHome({
    independentPresence: [
      homeMemoryPresence(memory),
      readingFacts.goalPresence,
      readingFacts.historyPresence,
      homeAttentionPresence(attention.data),
    ],
    libraryTotal,
  });
  const readingQuery = { isError: reading.isError, isRefetchError: reading.isRefetchError };
  const attentionState = homeAttentionCardState({
    data: attention.data,
    isError: attention.isError,
  });
  const criticalGroup = homeCriticalBanner(attention.data);

  const retryOverview = () => void overview.refetch();
  const retryMemory = () => {
    if (quotes.isError) void quotes.refetch();
    if (notes.isError) void notes.refetch();
  };
  const retryReading = () => void reading.refetch();
  const retryNextRead = () => void nextRead.refetch();
  const retryAttention = () => void attention.refetch();

  const welcome = (
    <HomeWelcomeSection
      action={
        isOnboarding ? null : (
          <Button asChild className="w-full @3xl/home:w-auto" size="lg">
            <Link href={HOME_LIBRARY_LINKS.addBook}>
              <UiIcon aria-hidden name="plus" size={18} />
              {t("actions.addBook")}
            </Link>
          </Button>
        )
      }
      displayName={homeDisplayName(user)}
      greetingTone={homeGreetingTone(calendar.partOfDay)}
      subtitle={homeSubtitleKey({
        activeBooksCount: readingFacts.activeBooksCount,
        hasReadToday: readingFacts.hasReadToday,
        libraryTotal,
      })}
      summary={
        <HomeLibrarySummaryStrip
          isRetrying={overview.isFetching}
          onRetry={retryOverview}
          state={homeSummaryState(overview)}
        />
      }
    />
  );

  const content: HomeDashboardContent = isOnboarding
    ? { kind: "onboarding", onboarding: <HomeOnboarding /> }
    : {
        kind: "zones",
        zones: {
          attention:
            attentionState.kind === "hidden" ? null : (
              <HomeAttentionCenter
                isRetrying={attention.isFetching}
                onRetry={retryAttention}
                state={attentionState}
              />
            ),
          criticalBanner:
            criticalGroup === null ? null : <HomeCriticalBanner group={criticalGroup} />,
          currentlyReading: (
            <HomeCurrentlyReading
              isQueueConfirmedEmpty={isQueueConfirmedEmpty(nextRead.data)}
              isRetrying={reading.isFetching}
              onRetry={retryReading}
              today={calendar.today}
              updatedAt={reading.dataUpdatedAt}
              widget={homeReadingWidget({
                ...readingQuery,
                section: reading.data?.currentlyReading,
              })}
            />
          ),
          memory:
            memory.kind === "hidden" ? null : (
              <HomeBookMemory
                isRetrying={quotes.isFetching || notes.isFetching}
                onRetry={retryMemory}
                selection={memory}
              />
            ),
          nextRead: (
            <HomeNextRead
              isRetrying={nextRead.isFetching}
              onRetry={retryNextRead}
              state={homeNextReadState({ data: nextRead.data, isError: nextRead.isError })}
            />
          ),
          readingGoal: (
            <HomeReadingGoal
              isRetrying={reading.isFetching}
              onRetry={retryReading}
              widget={homeReadingWidget({ ...readingQuery, section: reading.data?.readingGoal })}
            />
          ),
          readingWeek: (
            <HomeReadingWeek
              isRetrying={reading.isFetching}
              onRetry={retryReading}
              widget={homeReadingWidget({ ...readingQuery, section: reading.data?.readingWeek })}
            />
          ),
          recentBooks:
            recentShelf.kind === "hidden" ? null : (
              <HomeRecentBooks
                isRetrying={overview.isFetching}
                onRetry={retryOverview}
                state={recentShelf}
              />
            ),
        },
      };

  return <HomeDashboardLayout content={content} welcome={welcome} />;
}
