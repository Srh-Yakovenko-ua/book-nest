"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { RelationshipParticipant } from "../model/relationship-form-schema";

export function RelationshipParticipantChip({
  participant,
}: {
  participant: RelationshipParticipant;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        {participant.avatarUrl === null ? null : <AvatarImage alt="" src={participant.avatarUrl} />}
        <AvatarFallback>{participant.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{participant.name}</span>
    </span>
  );
}
