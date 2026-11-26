"use client";

import type { CharacterGraphNodeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCharacterDetailsPath } from "@/features/characters";
import { Link } from "@/i18n/navigation";

type GraphCharacterDetailsProps = {
  bookId: string;
  node: CharacterGraphNodeView;
  onExplore: () => void;
};

export function GraphCharacterDetails({ bookId, node, onExplore }: GraphCharacterDetailsProps) {
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
        <Button onClick={onExplore} size="sm" type="button">
          {t("explore")}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={getCharacterDetailsPath({ bookId, characterId: node.id })}>
            {t("profile")}
          </Link>
        </Button>
      </div>
      <section aria-labelledby="graph-character-connections" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" id="graph-character-connections">
          {t("connections", { count: 0 })}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noConnections")}</p>
      </section>
    </>
  );
}
