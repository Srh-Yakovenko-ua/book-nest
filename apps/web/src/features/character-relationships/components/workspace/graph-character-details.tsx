"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCharacterDetailsPath } from "@/features/characters/model/character-routes";
import { Link } from "@/i18n/navigation";

export type GraphCharacterConnectionItem = {
  connectionId: string;
  label: string;
  otherName: string;
};

type GraphCharacterDetailsProps = {
  bookId: string;
  branch: Nullable<{ expanded: boolean; onToggle: () => void }>;
  connections: readonly GraphCharacterConnectionItem[];
  isRoot: boolean;
  node: CharacterGraphNodeView;
  onExplore: Nullable<() => void>;
  onFindPath: Nullable<() => void>;
  onMakeCenter: Nullable<() => void>;
  onOpenConnection: (connectionId: string) => void;
};

export function GraphCharacterDetails({
  bookId,
  branch,
  connections,
  isRoot,
  node,
  onExplore,
  onFindPath,
  onMakeCenter,
  onOpenConnection,
}: GraphCharacterDetailsProps) {
  const t = useTranslations("relationships.workspace.panel.character");
  const tImportance = useTranslations("characters.importance");

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="size-14">
          {node.displayMedia === null ? null : (
            <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.card} />
          )}
          <AvatarFallback>{node.displayName.trim().charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="line-clamp-2 font-heading text-lg font-medium break-words">
            {node.displayName}
          </p>
          <div className="flex flex-wrap gap-1">
            {isRoot ? <Badge variant="secondary">{t("root")}</Badge> : null}
            {node.importance === null ? null : (
              <Badge variant="outline">{tImportance(node.importance)}</Badge>
            )}
            {node.isFavorite ? (
              <Badge variant="outline">
                <UiIcon className="text-favorite" name="heart-fill" size={12} />
                {t("favorite")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onMakeCenter === null ? null : (
          <Button onClick={onMakeCenter} size="sm" type="button">
            {t("makeCenter")}
          </Button>
        )}
        {onExplore === null ? null : (
          <Button onClick={onExplore} size="sm" type="button">
            {t("explore")}
          </Button>
        )}
        {branch === null ? null : (
          <Button onClick={branch.onToggle} size="sm" type="button" variant="outline">
            {t(branch.expanded ? "collapse" : "expand")}
          </Button>
        )}
        {onFindPath === null ? null : (
          <Button onClick={onFindPath} size="sm" type="button" variant="outline">
            {t("findPath")}
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link href={getCharacterDetailsPath({ bookId, characterId: node.id })}>
            {t("profile")}
          </Link>
        </Button>
      </div>
      <section aria-labelledby="graph-character-connections" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" id="graph-character-connections">
          {t("connections", { count: connections.length })}
        </h3>
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noConnections")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {connections.map((item) => (
              <li key={item.connectionId}>
                <Button
                  className="h-auto w-full justify-between gap-2 py-2 text-left"
                  onClick={() => onOpenConnection(item.connectionId)}
                  type="button"
                  variant="ghost"
                >
                  <span className="min-w-0 truncate font-medium">{item.otherName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
