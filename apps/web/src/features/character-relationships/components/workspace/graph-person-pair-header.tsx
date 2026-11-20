"use client";

import type { CharacterGraphNodeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import { GraphPersonRelationChip } from "./graph-person-relation-chip";

type GraphPersonPairHeaderProps = {
  first: CharacterGraphNodeView;
  nameOf: (id: string) => string;
  second: CharacterGraphNodeView;
  semantics: GraphPairSemantics;
};

export function GraphPersonPairHeader({
  first,
  nameOf,
  second,
  semantics,
}: GraphPersonPairHeaderProps) {
  const t = useTranslations("relationships.workspace.panel");

  return (
    <div className="flex items-center gap-3 pr-8">
      <div className="flex shrink-0 -space-x-4">
        {[first, second].map((node) => (
          <Avatar className="size-14 border-2 border-card ring-1 ring-border" key={node.id}>
            {node.displayMedia === null ? null : (
              <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
            )}
            <AvatarFallback className="font-heading text-lg">
              {node.displayName.trim().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-heading text-lg leading-tight font-semibold break-words text-ink">
          {t("connection.title", { source: first.displayName, target: second.displayName })}
        </p>
        <GraphPersonRelationChip className="self-start" semantics={semantics} />
        {semantics.tone === "masked" ? null : (
          <p className="text-xs text-muted-foreground">
            {semantics.direction.kind === "directed"
              ? t("person.direction.directed", {
                  source: nameOf(semantics.direction.sourceId),
                  target: nameOf(semantics.direction.targetId),
                })
              : t(`person.direction.${semantics.direction.kind}`)}
          </p>
        )}
      </div>
    </div>
  );
}
