"use client";

import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { UiIconName } from "@/components/icons";
import type { buttonVariants } from "@/components/ui/button";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MobilePageOverviewAction = {
  disabled?: boolean;
  icon?: ReactNode;
  id: string;
  label: string;
  onClick: () => void;
  variant?: VariantProps<typeof buttonVariants>["variant"];
};

export type MobilePageOverviewTab = {
  badge?: number;
  content: ReactNode;
  icon?: ReactNode;
  id: string;
  label: string;
};

type MobilePageOverviewPanelProps = {
  children?: ReactNode;
  closeLabel: string;
  defaultTab?: string;
  dragHandle?: boolean;
  emptyState?: ReactNode;
  error?: ReactNode;
  footerActions?: MobilePageOverviewAction[];
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  subtitle?: string;
  tabs?: MobilePageOverviewTab[];
  title: string;
};

const PANEL = {
  beyondMobileQuery: "(min-width: 40rem)",
  content:
    "h-dvh bg-background pt-[env(safe-area-inset-top)] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-dvh data-[vaul-drawer-direction=bottom]:rounded-none data-[vaul-drawer-direction=bottom]:border-t-0",
  dragHandleHidden: "[&>:first-child]:hidden",
  dragHandleVisible: "[&>:first-child]:mt-2.5 [&>:first-child]:w-9 [&>:first-child]:bg-border",
  historyGuardKey: "mobilePageOverviewPanel",
  maxFooterActions: 2,
  scroll: "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4",
  switcher:
    "w-full [&_[data-slot=segmented-item]]:min-w-0 [&_[data-slot=segmented-item]]:flex-auto [&_[data-slot=segmented-item]]:px-2.5",
  switcherScrollable:
    "no-scrollbar justify-start overflow-x-auto [&_[data-slot=segmented-item]]:flex-none",
  switcherSegmentedLimit: 3,
} as const;

const historyStateSchema = z.record(z.string(), z.unknown()).catch({});

export function MobilePageOverviewPanel({
  children,
  closeLabel,
  defaultTab,
  dragHandle = true,
  emptyState,
  error,
  footerActions,
  loading,
  onOpenChange,
  open,
  subtitle,
  tabs,
  title,
}: MobilePageOverviewPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;

    window.history.pushState(
      { ...historyStateSchema.parse(window.history.state), [PANEL.historyGuardKey]: true },
      "",
    );

    function handlePopState() {
      onOpenChangeRef.current(false);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (isHistoryGuardActive()) window.history.back();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const beyondMobile = window.matchMedia(PANEL.beyondMobileQuery);

    function closeBeyondMobile() {
      if (beyondMobile.matches) onOpenChangeRef.current(false);
    }

    closeBeyondMobile();
    beyondMobile.addEventListener("change", closeBeyondMobile);
    return () => beyondMobile.removeEventListener("change", closeBeyondMobile);
  }, [open]);

  const actions = (footerActions ?? []).slice(0, PANEL.maxFooterActions);

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent
        className={cn(PANEL.content, dragHandle ? PANEL.dragHandleVisible : PANEL.dragHandleHidden)}
        onOpenAutoFocus={() => contentRef.current?.focus()}
        ref={contentRef}
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DrawerTitle className="truncate text-base">{title}</DrawerTitle>
            <DrawerDescription
              className={cn("truncate text-xs", subtitle === undefined && "sr-only")}
            >
              {subtitle}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button
              aria-label={closeLabel}
              className="-mt-1.5 -mr-2 size-10 shrink-0 text-muted-foreground hover:text-ink"
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </DrawerClose>
        </header>

        <PanelBody
          defaultTab={defaultTab}
          emptyState={emptyState}
          error={error}
          loading={loading}
          tabs={tabs}
          title={title}
        >
          {children}
        </PanelBody>

        {actions.length === 0 ? null : (
          <footer className="flex shrink-0 gap-2.5 border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {actions.map((action) => (
              <Button
                className="h-11 flex-1"
                disabled={action.disabled}
                key={action.id}
                onClick={action.onClick}
                variant={action.variant}
              >
                {action.icon}
                <span className="truncate">{action.label}</span>
              </Button>
            ))}
          </footer>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export function MobilePageOverviewTrigger({
  icon = "chart",
  label,
  onClick,
}: {
  icon?: UiIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="h-11 w-full justify-start gap-2 rounded-xl px-3.5 shadow-card"
      onClick={onClick}
      variant="secondary"
    >
      <UiIcon aria-hidden className="shrink-0 text-primary" name={icon} size={16} />
      <span className="flex-1 truncate text-left font-heading text-sm font-semibold text-ink">
        {label}
      </span>
      <UiIcon
        aria-hidden
        className="shrink-0 text-muted-foreground"
        name="chevron-right"
        size={16}
      />
    </Button>
  );
}

function isHistoryGuardActive() {
  return historyStateSchema.parse(window.history.state)[PANEL.historyGuardKey] === true;
}

function PanelBody({
  children,
  defaultTab,
  emptyState,
  error,
  loading,
  tabs,
  title,
}: Pick<
  MobilePageOverviewPanelProps,
  "children" | "defaultTab" | "emptyState" | "error" | "loading" | "tabs" | "title"
>) {
  const panelTabs = tabs ?? [];
  const [firstTab] = panelTabs;
  const [selectedTab, setSelectedTab] = useState(defaultTab ?? firstTab?.id);
  const activeTab = panelTabs.find((tab) => tab.id === selectedTab) ?? firstTab;

  if (loading === true) return <PanelSkeleton />;

  if (error !== undefined) {
    return (
      <div className={PANEL.scroll} role="alert">
        {error}
      </div>
    );
  }

  if (activeTab === undefined) {
    return <div className={PANEL.scroll}>{children ?? emptyState}</div>;
  }

  if (panelTabs.length === 1) {
    return <div className={PANEL.scroll}>{activeTab.content}</div>;
  }

  return (
    <>
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <Segmented
          block
          className={cn(
            PANEL.switcher,
            panelTabs.length > PANEL.switcherSegmentedLimit && PANEL.switcherScrollable,
          )}
          label={title}
          onValueChange={setSelectedTab}
          options={panelTabs.map((tab) => ({
            icon: tab.icon,
            label: (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{tab.label}</span>
                {tab.badge === undefined || tab.badge <= 0 ? null : (
                  <Badge className="px-1.5" variant="secondary">
                    {tab.badge}
                  </Badge>
                )}
              </span>
            ),
            value: tab.id,
          }))}
          value={activeTab.id}
        />
      </div>

      <div className={PANEL.scroll}>{activeTab.content}</div>
    </>
  );
}

function PanelSkeleton() {
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton className="h-24 w-full rounded-xl" key={index} />
      ))}
    </div>
  );
}
