"use client";

import type { CharacterGraphNodeView } from "@app/shared";

import { MapPinned } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { filterByNetworkName, NETWORK_PANEL_LIST } from "./graph-network-panel-list";

const GROUP_MEMBERS = {
  moreValue: "network-group-members-more",
} as const;

export type GraphNetworkGroupMember = {
  isOnMap: boolean;
  node: CharacterGraphNodeView;
  pairCount: number;
};

type GraphNetworkGroupMembersProps = {
  groupLabel: string;
  members: readonly GraphNetworkGroupMember[];
  onSelect: (characterId: string) => void;
};

export function GraphNetworkGroupMembers({
  groupLabel,
  members,
  onSelect,
}: GraphNetworkGroupMembersProps) {
  const t = useTranslations("relationships.workspace.networkPanel");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState<number>(NETWORK_PANEL_LIST.batch);
  const matches = filterByNetworkName({
    items: members,
    namesOf: (member) => [member.node.displayName, member.node.name],
    query,
  });
  const visible = matches.slice(0, limit);
  const nextBatch = Math.min(NETWORK_PANEL_LIST.batch, matches.length - visible.length);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="flex min-w-0">
          <TruncatedText
            className="font-heading text-lg leading-tight font-semibold break-words text-ink"
            lines={2}
            text={groupLabel}
          />
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("members.count", { count: members.length })}
        </p>
      </div>
      <Command
        className="min-h-72 flex-1 border border-border bg-card"
        label={t("members.label", { name: groupLabel })}
        shouldFilter={false}
      >
        <CommandInput
          onKeyDown={(event) => {
            if (event.key !== "Escape" || query === "") return;
            event.preventDefault();
            setQuery("");
            setLimit(NETWORK_PANEL_LIST.batch);
          }}
          onValueChange={(next) => {
            setQuery(next);
            setLimit(NETWORK_PANEL_LIST.batch);
          }}
          placeholder={t("members.placeholder")}
          value={query}
        />
        <p className="sr-only" role="status">
          {query.trim().length === 0 ? "" : t("members.found", { count: matches.length })}
        </p>
        <CommandList className="max-h-none min-h-0 flex-1" label={t("members.listLabel")}>
          <CommandEmpty className="px-3 py-4 text-left">{t("members.empty")}</CommandEmpty>
          {visible.map((member) => (
            <CommandItem
              className="cursor-pointer"
              key={member.node.id}
              onSelect={() => onSelect(member.node.id)}
              value={member.node.id}
            >
              <Avatar aria-hidden size="sm">
                {member.node.displayMedia === null ? null : (
                  <AvatarImage alt="" src={member.node.displayMedia.urls.thumb} />
                )}
                <AvatarFallback>
                  {member.node.displayName.trim().charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <TruncatedText text={member.node.displayName} />
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{t("members.pairs", { count: member.pairCount })}</span>
                  {member.isOnMap ? (
                    <span className="inline-flex items-center gap-1 text-icon">
                      <MapPinned aria-hidden className="size-3.5" />
                      {t("members.onMap")}
                    </span>
                  ) : null}
                </span>
              </span>
            </CommandItem>
          ))}
          {nextBatch > 0 ? (
            <CommandItem
              className="cursor-pointer justify-center font-medium text-primary"
              onSelect={() => setLimit((current) => current + NETWORK_PANEL_LIST.batch)}
              value={GROUP_MEMBERS.moreValue}
            >
              {t("list.showMore", { count: nextBatch })}
            </CommandItem>
          ) : null}
        </CommandList>
      </Command>
    </>
  );
}
