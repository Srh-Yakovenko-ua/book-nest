"use client";

import type { LibraryPublisherDetail } from "@app/shared";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { useRouter } from "@/i18n/navigation";

import { DeletePublisherDialog } from "./delete-publisher-dialog";
import { EditPublisherDialog } from "./edit-publisher-dialog";
import { PublisherBooksTab } from "./publisher-books-tab";
import { PublisherDetailsHero } from "./publisher-details-hero";
import { PublisherOverviewTab } from "./publisher-overview-tab";
import { PublisherStatsGrid } from "./publisher-stats-grid";
import { PublisherToBuyTab } from "./publisher-to-buy-tab";

type PublisherDetailsViewProps = {
  details: LibraryPublisherDetail;
};

const DETAIL_TABS = ["overview", "books", "toBuy"] as const;

type DetailTab = (typeof DETAIL_TABS)[number];

const tabParser = parseAsStringLiteral(DETAIL_TABS).withDefault("overview");

export function PublisherDetailsView({ details }: PublisherDetailsViewProps) {
  const t = useTranslations("publishers.details.tabs");
  const router = useRouter();

  const [tab, setTab] = useQueryState("tab", tabParser);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const tabItems: PageTabsItem[] = [
    { label: t("overview"), value: "overview" },
    { label: t("books"), value: "books" },
    { label: t("toBuy"), value: "toBuy" },
  ];

  const onAddBook = () => router.push(`/books/new?publisherId=${details.id}`);

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
      <PublisherDetailsHero
        details={details}
        onAddBook={onAddBook}
        onDelete={() => setDeleteOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      <PublisherStatsGrid stats={details.stats} />

      <PageTabs
        items={tabItems}
        onValueChange={(value) => void setTab(isDetailTab(value) ? value : "overview")}
        value={tab}
      >
        <PageTabsPanel value="overview">
          <PublisherOverviewTab
            onViewBooks={() => void setTab("books")}
            onViewToBuy={() => void setTab("toBuy")}
            publisherId={details.id}
          />
        </PageTabsPanel>
        <PageTabsPanel value="books">
          <PublisherBooksTab publisherId={details.id} />
        </PageTabsPanel>
        <PageTabsPanel value="toBuy">
          <PublisherToBuyTab publisherId={details.id} />
        </PageTabsPanel>
      </PageTabs>

      {details.isCustom ? (
        <>
          <EditPublisherDialog details={details} onOpenChange={setEditOpen} open={editOpen} />
          <DeletePublisherDialog
            onOpenChange={setDeleteOpen}
            open={deleteOpen}
            publisherId={details.id}
            publisherName={details.name}
          />
        </>
      ) : null}
    </div>
  );
}

function isDetailTab(value: string): value is DetailTab {
  return DETAIL_TABS.includes(value as DetailTab);
}
