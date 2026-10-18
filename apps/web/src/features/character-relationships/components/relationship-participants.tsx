"use client";

import type {
  Nullable,
  RelationshipDirectionality,
  SafeParticipantView,
  SafeRelationshipEdgeView,
} from "@app/shared";

import { ArrowLeft, ArrowLeftRight, ArrowRight, Minus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { assertNever } from "@/lib/assert-never";
import { cn } from "@/lib/utils";

import { useRelationshipLabels } from "../model/use-relationship-labels";

const PARTICIPANTS_SIZE = {
  card: { avatar: "default", connector: "size-4", name: "text-sm" },
  dialog: { avatar: "lg", connector: "size-5", name: "text-base" },
} as const;

type ParticipantProps = {
  isMuted: boolean;
  participant: SafeParticipantView;
  size: RelationshipParticipantsSize;
};

type RelationshipParticipantsProps = {
  edge: Pick<SafeRelationshipEdgeView, "directionality" | "source" | "target">;
  focusCharacterId: Nullable<string>;
  size: RelationshipParticipantsSize;
};

type RelationshipParticipantsSize = keyof typeof PARTICIPANTS_SIZE;

export function RelationshipParticipants({
  edge,
  focusCharacterId,
  size,
}: RelationshipParticipantsProps) {
  const labels = useRelationshipLabels();
  const isSourceFocused = edge.source.id === focusCharacterId;
  const [first, second] = isSourceFocused ? [edge.target, edge.source] : [edge.source, edge.target];

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Participant isMuted={first.id === focusCharacterId} participant={first} size={size} />
      <span
        aria-label={labels.directionality(edge.directionality)}
        className="inline-flex shrink-0 text-muted-foreground"
        role="img"
      >
        <RelationshipConnector
          className={PARTICIPANTS_SIZE[size].connector}
          directionality={edge.directionality}
          isReversed={isSourceFocused}
        />
      </span>
      <Participant isMuted={second.id === focusCharacterId} participant={second} size={size} />
    </span>
  );
}

function Participant({ isMuted, participant, size }: ParticipantProps) {
  const styles = PARTICIPANTS_SIZE[size];

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size={styles.avatar}>
        {participant.avatar === null ? null : (
          <AvatarImage alt="" src={participant.avatar.urls.thumb} />
        )}
        <AvatarFallback>{participant.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "min-w-0 truncate",
          styles.name,
          isMuted ? "text-muted-foreground" : "font-semibold text-ink",
        )}
      >
        {participant.name}
      </span>
    </span>
  );
}

function RelationshipConnector({
  className,
  directionality,
  isReversed,
}: {
  className: string;
  directionality: Nullable<RelationshipDirectionality>;
  isReversed: boolean;
}) {
  if (directionality === null) return <Minus aria-hidden className={className} />;

  switch (directionality) {
    case "directed":
      return isReversed ? (
        <ArrowLeft aria-hidden className={className} />
      ) : (
        <ArrowRight aria-hidden className={className} />
      );
    case "symmetric":
      return <ArrowLeftRight aria-hidden className={className} />;
    default:
      return assertNever(directionality);
  }
}
