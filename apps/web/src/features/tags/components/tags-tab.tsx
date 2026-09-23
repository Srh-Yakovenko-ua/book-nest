"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { TagCardItem } from "../model/tags-derive";

import { popularTags, TAG_PREVIEW_LIMIT } from "../model/tags-derive";
import { TagChip } from "./tag-chip";
import { TagRow } from "./tag-row";

const SKELETON_COUNT = 10;

type TagsTabProps = {
  allTags: TagCardItem[];
  hasAnyTags: boolean;
  isError: boolean;
  isPending: boolean;
  onAddTag: () => void;
  onClearFilters: () => void;
  onDeleteTag: (tag: TagCardItem) => void;
  onEditTag: (tag: TagCardItem) => void;
  onRetry: () => void;
  tags: TagCardItem[];
};

export function TagsTab({
  allTags,
  hasAnyTags,
  isError,
  isPending,
  onAddTag,
  onClearFilters,
  onDeleteTag,
  onEditTag,
  onRetry,
  tags,
}: TagsTabProps) {
  const t = useTranslations("genresTags.tags");
  const tStates = useTranslations("genresTags.states");
  const [expanded, setExpanded] = useState(false);

  if (isError) {
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState
          onPrimary={onRetry}
          state={{
            desc: tStates("error.description"),
            illu: "error-generic",
            primary: { icon: "refresh", label: tStates("error.retry") },
            title: tStates("error.title"),
          }}
        />
      </div>
    );
  }

  if (isPending) {
    return <TagsSkeleton />;
  }

  if (!hasAnyTags) {
    return (
      <EmptyState
        onPrimary={onAddTag}
        state={{
          desc: t("empty.description"),
          illu: "empty-tags",
          primary: { icon: "plus", label: t("empty.action") },
          title: t("empty.title"),
        }}
      />
    );
  }

  const popular = popularTags(allTags);
  const visible = expanded ? tags : tags.slice(0, TAG_PREVIEW_LIMIT);
  const canExpand = tags.length > TAG_PREVIEW_LIMIT;

  return (
    <div className="flex flex-col gap-8">
      {popular.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-base font-semibold text-ink">{t("popularTitle")}</h3>
          <div className="flex flex-wrap gap-2">
            {popular.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-base font-semibold text-ink">{t("allTitle")}</h3>
        {tags.length === 0 ? (
          <EmptyState
            onPrimary={onClearFilters}
            state={{
              desc: t("noResults.description"),
              illu: "empty-search",
              primary: { icon: "x", label: tStates("noResults.clear") },
              title: t("noResults.title"),
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {visible.map((tag) => (
                <TagRow
                  key={tag.id}
                  onDelete={() => onDeleteTag(tag)}
                  onEdit={() => onEditTag(tag)}
                  tag={tag}
                />
              ))}
            </div>
            {canExpand ? (
              <Button
                className="self-center"
                onClick={() => setExpanded((value) => !value)}
                variant="secondary"
              >
                {expanded ? t("showLess") : t("showAll", { count: tags.length })}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function TagsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Skeleton className="h-8 w-24 rounded-full" key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Skeleton className="h-14 w-full rounded-lg" key={index} />
        ))}
      </div>
    </div>
  );
}
