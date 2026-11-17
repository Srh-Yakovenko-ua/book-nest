"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { WorkspaceWidthClass } from "./use-workspace-width-class";

type GraphDetailsPanelProps = {
  children: ReactNode;
  onClose: () => void;
  onRestoreFocus: () => void;
  open: boolean;
  title: string;
  widthClass: WorkspaceWidthClass;
};

const PANEL_STYLES = {
  medium:
    "absolute inset-y-2 right-2 z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-lg",
  wide: "w-96 shrink-0 rounded-2xl border border-border bg-card",
} as const;

export function GraphDetailsPanel({
  children,
  onClose,
  onRestoreFocus,
  open,
  title,
  widthClass,
}: GraphDetailsPanelProps) {
  const t = useTranslations("relationships.workspace.panel");
  const closeButton = useRef<HTMLButtonElement>(null);
  const isInline = open && widthClass !== "compact";

  useEffect(() => {
    if (isInline) closeButton.current?.focus();
  }, [isInline, title]);

  if (widthClass === "compact") {
    return (
      <Sheet
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        open={open}
      >
        <SheetContent
          className="max-h-4/5 overflow-y-auto safe-bottom"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          side="bottom"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">{t("description")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <aside
      aria-label={title}
      className={cn("flex flex-col overflow-hidden", PANEL_STYLES[widthClass])}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="min-w-0 truncate font-heading text-base font-medium">{title}</h2>
        <Button
          aria-label={t("close")}
          onClick={() => {
            onClose();
            onRestoreFocus();
          }}
          ref={closeButton}
          size="icon"
          type="button"
          variant="ghost"
        >
          <UiIcon name="x" size={16} />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
