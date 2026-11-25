"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { EyeOff, Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { NetworkBucket, NetworkIndex } from "../../model/workspace/graph-network-index";

import { searchNetwork } from "../../model/workspace/graph-network-search";

export type GraphNetworkSearchProps = {
  blockedNodes: readonly CharacterGraphNodeView[];
  compact: boolean;
  index: NetworkIndex;
  labelOf: (bucket: NetworkBucket) => string;
  onOpenChange: (open: boolean) => void;
  onPickBlocked: (node: CharacterGraphNodeView) => void;
  onPickCharacter: (characterId: string) => void;
  onPickGroup: (bucketId: string) => void;
  triggerId: string;
};

export function GraphNetworkSearch({
  blockedNodes,
  compact,
  index,
  labelOf,
  onOpenChange,
  onPickBlocked,
  onPickCharacter,
  onPickGroup,
  triggerId,
}: GraphNetworkSearchProps) {
  const t = useTranslations("relationships.workspace.networkSearch");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const picked = useRef(false);
  const hasQuery = query.trim().length > 0;
  const results = open && hasQuery ? searchNetwork({ blockedNodes, index, labelOf, query }) : [];
  const groups = results.flatMap((result) => (result.kind === "group" ? [result] : []));
  const characters = results.flatMap((result) => (result.kind === "character" ? [result] : []));
  const blocked = results.flatMap((result) => (result.kind === "blocked" ? [result] : []));

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
    onOpenChange(next);
  }

  function pick(choose: () => void) {
    picked.current = true;
    choose();
    changeOpen(false);
  }

  function groupOf(bucketId: string): Nullable<string> {
    const bucket = index.bucketById.get(bucketId);
    return bucket === undefined ? null : labelOf(bucket);
  }

  return (
    <Popover onOpenChange={changeOpen} open={open}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            aria-label={t("trigger")}
            id={triggerId}
            size="icon"
            type="button"
            variant="outline"
          >
            <Search aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button
            className="w-full min-w-0 justify-start sm:w-60"
            id={triggerId}
            type="button"
            variant="outline"
          >
            <Search aria-hidden className="size-4" />
            <span className="truncate text-muted-foreground">{t("trigger")}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-(--radix-popover-content-available-width) p-0"
        onCloseAutoFocus={(event) => {
          if (!picked.current) return;
          picked.current = false;
          const { activeElement } = document;
          if (activeElement === null || activeElement === document.body) return;
          event.preventDefault();
        }}
      >
        <Command label={t("label")} shouldFilter={false}>
          <CommandInput onValueChange={setQuery} placeholder={t("placeholder")} value={query} />
          {hasQuery ? null : <p className="px-3 py-4 text-sm text-muted-foreground">{t("hint")}</p>}
          <p className="sr-only" role="status">
            {hasQuery ? t("found", { count: results.length }) : ""}
          </p>
          <CommandList label={t("listLabel")}>
            {hasQuery ? (
              <CommandEmpty className="flex flex-col gap-1 px-3 py-4 text-left text-sm">
                <span className="font-medium">{t("empty")}</span>
                <span className="text-muted-foreground">{t("emptyHint")}</span>
              </CommandEmpty>
            ) : null}
            {groups.length === 0 ? null : (
              <CommandGroup heading={t("groups")}>
                {groups.map(({ bucket }) => {
                  const label = labelOf(bucket);
                  return (
                    <CommandItem
                      className="cursor-pointer"
                      key={bucket.id}
                      onSelect={() => pick(() => onPickGroup(bucket.id))}
                      value={bucket.id}
                    >
                      <span
                        aria-hidden
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-icon"
                      >
                        <Users className="size-3.5" />
                      </span>
                      <ResultText
                        meta={t("groupMeta", { count: bucket.memberIds.length })}
                        name={label}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {characters.length === 0 ? null : (
              <CommandGroup heading={t("characters")}>
                {characters.map(({ bucketId, node }) => {
                  const group = groupOf(bucketId);
                  return (
                    <CommandItem
                      className="cursor-pointer"
                      key={node.id}
                      onSelect={() => pick(() => onPickCharacter(node.id))}
                      value={node.id}
                    >
                      <ResultAvatar node={node} />
                      <ResultText
                        meta={
                          group === null ? t("characterMeta") : t("characterInGroupMeta", { group })
                        }
                        name={node.displayName}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {blocked.length === 0 ? null : (
              <CommandGroup heading={t("blocked")}>
                {blocked.map(({ node }) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={node.id}
                    onSelect={() => pick(() => onPickBlocked(node))}
                    value={node.id}
                  >
                    <ResultAvatar className="opacity-60" node={node} />
                    <ResultText meta={t("blockedMeta")} name={node.displayName} />
                    <EyeOff aria-hidden className="size-4 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ResultAvatar({ className, node }: { className?: string; node: CharacterGraphNodeView }) {
  return (
    <Avatar aria-hidden className={className} size="sm">
      {node.displayMedia === null ? null : (
        <AvatarImage alt="" src={node.displayMedia.urls.thumb} />
      )}
      <AvatarFallback>{node.displayName.trim().charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function ResultText({ meta, name }: { meta: string; name: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <TruncatedText text={name} />
      <TruncatedText className="text-xs text-muted-foreground" text={meta} />
    </span>
  );
}
