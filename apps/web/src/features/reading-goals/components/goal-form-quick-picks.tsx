"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { GOAL_FORM, goalDeadlineShortcuts, goalTargetPresets } from "../model/goal-form";

type GoalDeadlineShortcutsProps = {
  onSelect: (deadline: string) => void;
  today: Date;
  value: string;
};

type GoalTargetPresetsProps = {
  bookCount: number;
  onSelect: (targetCount: number) => void;
  value: number;
};

type QuickPickButtonProps = {
  children: ReactNode;
  onClick: () => void;
  pressed: boolean;
};

type QuickPickGroupProps = {
  children: ReactNode;
  label: string;
};

export function GoalDeadlineShortcuts({ onSelect, today, value }: GoalDeadlineShortcutsProps) {
  const t = useTranslations("goals.form.deadlineShortcuts");
  const shortcuts = goalDeadlineShortcuts(today);

  return (
    <QuickPickGroup label={t("label")}>
      {shortcuts.map((shortcut) => (
        <QuickPickButton
          key={shortcut.kind}
          onClick={() => onSelect(shortcut.value)}
          pressed={shortcut.value === value}
        >
          {t(shortcut.kind, { count: GOAL_FORM.deadlineShortcutMonths })}
        </QuickPickButton>
      ))}
    </QuickPickGroup>
  );
}

export function GoalTargetPresets({ bookCount, onSelect, value }: GoalTargetPresetsProps) {
  const t = useTranslations("goals.form.targetPresets");
  const presets = goalTargetPresets(bookCount);

  if (presets.length === 0) return null;

  return (
    <QuickPickGroup label={t("label")}>
      {presets.map((preset) => (
        <QuickPickButton
          key={preset.value}
          onClick={() => onSelect(preset.value)}
          pressed={preset.value === value}
        >
          {preset.kind === "count" ? preset.value : t(preset.kind, { count: preset.value })}
        </QuickPickButton>
      ))}
    </QuickPickGroup>
  );
}

function QuickPickButton({ children, onClick, pressed }: QuickPickButtonProps) {
  return (
    <Button
      aria-pressed={pressed}
      className="tabular-nums aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary max-sm:h-9"
      onClick={onClick}
      size="sm"
      type="button"
      variant="secondary"
    >
      {children}
    </Button>
  );
}

function QuickPickGroup({ children, label }: QuickPickGroupProps) {
  return (
    <div aria-label={label} className="flex flex-wrap items-center gap-1.5" role="group">
      {children}
    </div>
  );
}
