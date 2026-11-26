"use client";

import type { CharacterGraphNodeView } from "@app/shared";

import { ArrowLeft, ArrowLeftRight, ArrowRight, ArrowRightLeft, Minus } from "lucide-react";
import { useTranslations } from "next-intl";

import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import { GraphPersonRelationChip } from "./graph-person-relation-chip";
import { GRAPH_PERSON_TONES } from "./graph-person-tones";

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
  const isMasked = semantics.tone === "masked";
  const isMixed = !isMasked && semantics.direction.kind === "mixed";

  return (
    <div className="flex flex-col gap-2">
      <h3 className="sr-only">
        {t("connection.title", { source: first.displayName, target: second.displayName })}
      </h3>
      {isMasked || isMixed ? null : (
        <p className="sr-only">
          {semantics.direction.kind === "directed"
            ? t("person.direction.directed", {
                source: nameOf(semantics.direction.sourceId),
                target: nameOf(semantics.direction.targetId),
              })
            : t(`person.direction.${semantics.direction.kind}`)}
        </p>
      )}
      <div aria-hidden className="flex items-start gap-2">
        <PairParticipant node={first} />
        <span
          className={cn(
            "mt-2.5 flex shrink-0 items-center justify-center rounded-full border border-border bg-card p-1.5",
            GRAPH_PERSON_TONES[semantics.tone].iconColor,
          )}
        >
          <PairConnector firstId={first.id} semantics={semantics} />
        </span>
        <PairParticipant node={second} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <GraphPersonRelationChip semantics={semantics} />
        {isMixed ? (
          <p className="text-xs text-muted-foreground">{t("person.direction.mixed")}</p>
        ) : null}
      </div>
    </div>
  );
}

function PairConnector({ firstId, semantics }: { firstId: string; semantics: GraphPairSemantics }) {
  if (semantics.tone === "masked") return <Minus className="size-4" />;
  const { direction } = semantics;
  if (direction.kind === "symmetric") return <ArrowLeftRight className="size-4" />;
  if (direction.kind === "mixed") return <ArrowRightLeft className="size-4" />;
  return direction.sourceId === firstId ? (
    <ArrowRight className="size-4" />
  ) : (
    <ArrowLeft className="size-4" />
  );
}

function PairParticipant({ node }: { node: CharacterGraphNodeView }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <Avatar className="size-12 border-2 border-card ring-1 ring-border">
        {node.displayMedia === null ? null : (
          <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
        )}
        <AvatarFallback className="font-heading text-base">
          {node.displayName.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <TruncatedText
        className="font-heading text-sm leading-tight font-semibold break-words text-ink"
        lines={2}
        text={node.displayName}
      />
    </span>
  );
}
