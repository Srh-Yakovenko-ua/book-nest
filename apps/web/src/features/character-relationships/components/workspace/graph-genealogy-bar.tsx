"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { ChevronsUpDown, GitBranch, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { GraphGenealogyBranch } from "./graph-genealogy-branches";

import { searchGenealogyCharacters } from "../../model/workspace/graph-genealogy-navigation";
import { toGraphGenealogyHouseTone } from "./graph-genealogy-tones";

export type GraphGenealogyBarProps = {
  activeBranchId: Nullable<string>;
  branches: readonly GraphGenealogyBranch[];
  branchesTriggerId: string;
  characters: readonly CharacterGraphNodeView[];
  compact: boolean;
  hiddenIds: ReadonlySet<string>;
  onBranch: (branchId: Nullable<string>) => void;
  onFind: (characterId: string) => void;
};

export function GraphGenealogyBar({
  activeBranchId,
  branches,
  branchesTriggerId,
  characters,
  compact,
  hiddenIds,
  onBranch,
  onFind,
}: GraphGenealogyBarProps) {
  const t = useTranslations("relationships.workspace.genealogy.bar");
  const houses = branches.filter((branch) => branch.kind === "house");
  const families = branches.filter((branch) => branch.kind === "family");
  const active = branches.find((branch) => branch.id === activeBranchId);

  return (
    <>
      <CharacterSearch
        characters={characters}
        compact={compact}
        hiddenIds={hiddenIds}
        onFind={onFind}
      />
      {branches.length === 0 ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn("min-w-0", compact ? "max-w-40" : "max-w-60")}
              id={branchesTriggerId}
              type="button"
              variant="outline"
            >
              <GitBranch aria-hidden className="size-4" />
              <span className="truncate">
                {active === undefined
                  ? t(compact ? "branchesShort" : "branches")
                  : t("branchActive", { name: active.label })}
              </span>
              <ChevronsUpDown aria-hidden className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {houses.length === 0 ? null : (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("houses")}</DropdownMenuLabel>
                {houses.map((branch) => (
                  <BranchItem branch={branch} key={branch.id} onBranch={onBranch} />
                ))}
              </DropdownMenuGroup>
            )}
            {families.length < 2 ? null : (
              <>
                {houses.length === 0 ? null : <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t("families")}</DropdownMenuLabel>
                  {families.map((branch) => (
                    <BranchItem branch={branch} key={branch.id} onBranch={onBranch} />
                  ))}
                </DropdownMenuGroup>
              </>
            )}
            {active === undefined ? null : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onBranch(null)}>
                  {t("clearBranch")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

function BranchItem({
  branch,
  onBranch,
}: {
  branch: GraphGenealogyBranch;
  onBranch: (branchId: Nullable<string>) => void;
}) {
  const t = useTranslations("relationships.workspace.genealogy.bar");

  return (
    <DropdownMenuItem onSelect={() => onBranch(branch.id)}>
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          branch.tone === null
            ? "bg-muted-foreground/50"
            : toGraphGenealogyHouseTone(branch.tone).dot,
        )}
      />
      <span className="min-w-0 flex-1 truncate">{branch.label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("members", { count: branch.count })}
      </span>
    </DropdownMenuItem>
  );
}

function CharacterSearch({
  characters,
  compact,
  hiddenIds,
  onFind,
}: {
  characters: readonly CharacterGraphNodeView[];
  compact: boolean;
  hiddenIds: ReadonlySet<string>;
  onFind: (characterId: string) => void;
}) {
  const t = useTranslations("relationships.workspace.genealogy.search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const picked = useRef(false);
  const matches = searchGenealogyCharacters({ nodes: characters, query });

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        {compact ? (
          <Button aria-label={t("trigger")} size="icon" type="button" variant="outline">
            <Search aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button className="w-full justify-start sm:w-52" type="button" variant="outline">
            <Search aria-hidden className="size-4" />
            <span className="truncate text-muted-foreground">{t("trigger")}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        onCloseAutoFocus={(event) => {
          if (!picked.current) return;
          picked.current = false;
          event.preventDefault();
        }}
      >
        <Command label={t("label")} shouldFilter={false}>
          <CommandInput onValueChange={setQuery} placeholder={t("placeholder")} value={query} />
          {query.trim().length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("hint", { count: characters.length })}
            </p>
          ) : null}
          <p className="sr-only" role="status">
            {query.trim().length === 0 ? "" : t("found", { count: matches.length })}
          </p>
          <CommandList label={t("listLabel")}>
            {query.trim().length === 0 ? null : (
              <CommandEmpty className="flex flex-col gap-1 px-3 py-4 text-left text-sm">
                <span className="font-medium">{t("empty")}</span>
                <span className="text-muted-foreground">{t("emptyHint")}</span>
              </CommandEmpty>
            )}
            {matches.length === 0 ? null : (
              <CommandGroup heading={t("results")}>
                {matches.map((node) => {
                  const isHidden = hiddenIds.has(node.id);
                  return (
                    <CommandItem
                      className="cursor-pointer"
                      key={node.id}
                      onSelect={() => {
                        picked.current = true;
                        onFind(node.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      value={node.id}
                    >
                      <Avatar size="sm">
                        {node.displayMedia === null ? null : (
                          <AvatarImage alt="" src={node.displayMedia.urls.thumb} />
                        )}
                        <AvatarFallback>
                          {node.displayName.trim().charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="line-clamp-2">{node.displayName}</span>
                        {isHidden ? (
                          <span className="text-xs text-muted-foreground">{t("collapsed")}</span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
