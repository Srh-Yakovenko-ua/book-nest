"use client";

import type { CharacterGraphNodeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { focusOnMount } from "@/lib/focus-on-mount";

import type { RelationshipGraphScope } from "../model/relationship-graph-scope";

import { toRelationshipGraphCharacterHref } from "../model/relationship-graph-scope";

type RelationshipGraphNodePreviewProps = {
  node: CharacterGraphNodeView;
  onClose: () => void;
  onFocus: () => void;
  scope: RelationshipGraphScope;
};

export function RelationshipGraphNodePreview({
  node,
  onClose,
  onFocus,
  scope,
}: RelationshipGraphNodePreviewProps) {
  const t = useTranslations("relationships.graph.preview");
  const tImportance = useTranslations("characters.importance");

  return (
    <aside
      aria-label={t("label")}
      className="absolute inset-x-3 top-3 z-10 flex flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-auto sm:w-80"
      ref={focusOnMount}
      tabIndex={-1}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate font-heading text-lg font-medium text-foreground">{node.name}</h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {node.importance === null ? null : <span>{tImportance(node.importance)}</span>}
            <span>{t("connections", { count: node.degree })}</span>
            {node.isFavorite ? (
              <span className="flex items-center gap-1 text-favorite">
                <UiIcon name="heart-fill" size={12} />
                {t("favorite")}
              </span>
            ) : null}
          </p>
        </div>
        <Button aria-label={t("close")} onClick={onClose} size="icon" variant="ghost">
          <UiIcon name="x" size={16} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={toRelationshipGraphCharacterHref({ node, scope })}>
            <UiIcon name="arrow-up-right" size={14} />
            {t("openPage")}
          </Link>
        </Button>
        <Button onClick={onFocus} size="sm" variant="secondary">
          <UiIcon name="target" size={14} />
          {t("focus")}
        </Button>
      </div>
    </aside>
  );
}
