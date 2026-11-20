"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { WorkspaceWidthClass } from "./use-workspace-width-class";

type GraphDetailsPanelProps = {
  appearance: "default" | "person";
  autoFocus: boolean;
  children: ReactNode;
  heading?: string;
  onClose: () => void;
  onRestoreFocus: () => void;
  open: boolean;
  title: string;
  widthClass: WorkspaceWidthClass;
};

const PANEL_STYLES = {
  body: "flex min-h-0 flex-1 scroll-pb-20 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain p-4",
  close: "size-11 shrink-0",
  default: {
    medium:
      "absolute inset-y-2 right-2 z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-lg",
    wide: "w-96 shrink-0 rounded-2xl border border-border bg-card",
  },
  person: {
    medium:
      "absolute inset-y-2 right-2 z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-pop",
    wide: "absolute inset-0 rounded-2xl border border-border bg-card shadow-card",
  },
  personHeader:
    "flex shrink-0 items-center justify-between gap-2 border-b border-border py-1 pr-1.5 pl-4",
  personHeading: "text-sm font-medium text-muted-foreground",
} as const;

export function GraphDetailsPanel({
  appearance,
  autoFocus,
  children,
  heading,
  onClose,
  onRestoreFocus,
  open,
  title,
  widthClass,
}: GraphDetailsPanelProps) {
  const t = useTranslations("relationships.workspace.panel");
  const closeButton = useRef<HTMLButtonElement>(null);
  const isInline = open && widthClass !== "compact";
  const shouldFocus = isInline && autoFocus;

  useEffect(() => {
    if (shouldFocus) closeButton.current?.focus();
  }, [shouldFocus, title]);

  if (widthClass === "compact" && appearance === "person") {
    return (
      <Sheet
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        open={open}
      >
        <SheetContent
          className="max-h-4/5 gap-0 safe-bottom"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          showCloseButton={false}
          side="bottom"
        >
          <div className={PANEL_STYLES.personHeader}>
            <p aria-hidden className={PANEL_STYLES.personHeading}>
              {heading ?? title}
            </p>
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <SheetDescription className="sr-only">{t("description")}</SheetDescription>
            <SheetClose asChild>
              <Button
                aria-label={t("close")}
                className={PANEL_STYLES.close}
                size="icon"
                type="button"
                variant="ghost"
              >
                <UiIcon name="x" size={18} />
              </Button>
            </SheetClose>
          </div>
          <div className={PANEL_STYLES.body}>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

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

  if (appearance === "person") {
    return (
      <aside
        aria-label={title}
        className={cn("flex min-h-0 flex-col overflow-hidden", PANEL_STYLES.person[widthClass])}
      >
        <div className={PANEL_STYLES.personHeader}>
          <h2 className={PANEL_STYLES.personHeading}>{heading ?? title}</h2>
          <Button
            aria-label={t("close")}
            className={PANEL_STYLES.close}
            onClick={() => {
              onClose();
              onRestoreFocus();
            }}
            ref={closeButton}
            size="icon"
            type="button"
            variant="ghost"
          >
            <UiIcon name="x" size={18} />
          </Button>
        </div>
        <div className={PANEL_STYLES.body}>{children}</div>
      </aside>
    );
  }

  return (
    <aside
      aria-label={title}
      className={cn("flex flex-col overflow-hidden", PANEL_STYLES.default[widthClass])}
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
