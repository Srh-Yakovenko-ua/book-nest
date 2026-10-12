"use client";

import type { OwnSpeciesView } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ClampedSpeciesName } from "./clamped-species-name";
import { OwnSpeciesUsage } from "./own-species-usage";

type OwnSpeciesRowProps = {
  menuTriggerRef?: Ref<HTMLButtonElement>;
  onDelete: () => void;
  onMerge: () => void;
  onRename: () => void;
  species: OwnSpeciesView;
};

export function OwnSpeciesRow({
  menuTriggerRef,
  onDelete,
  onMerge,
  onRename,
  species,
}: OwnSpeciesRowProps) {
  const t = useTranslations("species.manage");

  return (
    <li className="group flex items-start gap-2 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ClampedSpeciesName
          className="text-sm font-medium text-foreground group-focus-within:line-clamp-none"
          name={species.name}
        />
        <span className="text-xs text-muted-foreground">
          <OwnSpeciesUsage usage={species.usage} />
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("actions", { name: species.name })}
            className="-my-1 -mr-1 shrink-0 text-muted-foreground hover:text-foreground"
            ref={menuTriggerRef}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={onRename}>
            <UiIcon name="edit" size={16} />
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMerge}>
            <UiIcon name="swap" size={16} />
            {t("merge")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} variant="destructive">
            <UiIcon name="trash" size={16} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
