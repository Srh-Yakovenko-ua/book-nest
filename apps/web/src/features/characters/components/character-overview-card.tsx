"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { Fragment } from "react";

import type { UiIconName } from "@/components/icons";

import { Separator } from "@/components/ui/separator";
import { FormSection } from "@/features/books";

type CharacterOverviewCardProps = {
  groups: readonly Nullable<CharacterOverviewGroup>[];
  icon: UiIconName;
  title: string;
};

type CharacterOverviewGroup = {
  content: ReactNode;
  key: string;
  title: string;
};

export function CharacterOverviewCard({ groups, icon, title }: CharacterOverviewCardProps) {
  const shownGroups = groups.filter((group) => group !== null);

  if (shownGroups.length === 0) return null;

  return (
    <FormSection icon={icon} title={title}>
      {shownGroups.map((group, index) => (
        <Fragment key={group.key}>
          {index === 0 ? null : <Separator />}
          <div className="flex flex-col gap-4">
            <h3 className="min-w-0 text-sm font-semibold text-ink">{group.title}</h3>
            {group.content}
          </div>
        </Fragment>
      ))}
    </FormSection>
  );
}
