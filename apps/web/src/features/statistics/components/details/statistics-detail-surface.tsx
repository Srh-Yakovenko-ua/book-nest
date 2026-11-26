"use client";

import type { ReactNode, Ref } from "react";

import { createContext, use, useId, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type StatisticsDetailSurfaceProps = {
  children: ReactNode;
  compact?: { closeLabel: string; eyebrow: string };
  contentClassName?: string;
  detail: (context: { close: () => void }) => ReactNode;
  label?: string;
  onCloseAutoFocus?: (event: Event) => void;
  title: string;
  triggerClassName?: string;
  triggerRef?: Ref<HTMLButtonElement>;
};

const COMPACT_POPOVER = {
  body: "min-h-0 overflow-y-auto px-4 pb-4",
  collisionPadding: 16,
  content:
    "max-h-(--radix-popover-content-available-height) w-92 max-w-[calc(100vw-2rem)] gap-3 p-0",
  eyebrow: "text-xs font-medium text-muted-foreground",
  header: "flex items-start justify-between gap-2 px-4 pt-3.5",
  title: "text-lg leading-tight font-semibold text-ink",
} as const;

const InsideDrawerContext = createContext(false);

export function StatisticsDetailSurface({
  children,
  compact,
  contentClassName,
  detail,
  label,
  onCloseAutoFocus,
  title,
  triggerClassName,
  triggerRef,
}: StatisticsDetailSurfaceProps) {
  const isInsideDrawer = use(InsideDrawerContext);
  const isMobile = useIsMobile() || isInsideDrawer;
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const close = () => setOpen(false);

  if (isMobile) {
    const DrawerRoot = isInsideDrawer ? DrawerPrimitive.NestedRoot : Drawer;

    return (
      <DrawerRoot autoFocus onOpenChange={setOpen} open={open}>
        <DrawerTrigger
          aria-label={label}
          className={cn("cursor-pointer text-left", triggerClassName)}
          ref={triggerRef}
        >
          {children}
        </DrawerTrigger>
        <DrawerContent onCloseAutoFocus={onCloseAutoFocus}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className={cn("overflow-y-auto px-5 py-4", contentClassName)}>
            <InsideDrawerContext value>{open ? detail({ close }) : null}</InsideDrawerContext>
          </div>
        </DrawerContent>
      </DrawerRoot>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={label}
        className={cn("cursor-pointer text-left", triggerClassName)}
        ref={triggerRef}
      >
        {children}
      </PopoverTrigger>
      {compact === undefined ? (
        <PopoverContent
          align="start"
          aria-labelledby={titleId}
          className={cn("w-80", contentClassName)}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <PopoverHeader>
            <PopoverTitle id={titleId}>{title}</PopoverTitle>
          </PopoverHeader>
          {open ? detail({ close }) : null}
        </PopoverContent>
      ) : (
        <PopoverContent
          align="start"
          aria-labelledby={titleId}
          className={cn(COMPACT_POPOVER.content, contentClassName)}
          collisionPadding={COMPACT_POPOVER.collisionPadding}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className={COMPACT_POPOVER.header}>
            <PopoverHeader>
              <p className={COMPACT_POPOVER.eyebrow}>{compact.eyebrow}</p>
              <PopoverTitle className={COMPACT_POPOVER.title} id={titleId}>
                {title}
              </PopoverTitle>
            </PopoverHeader>
            <Button aria-label={compact.closeLabel} onClick={close} size="icon-sm" variant="ghost">
              <UiIcon name="x" size={16} />
            </Button>
          </div>
          <div className={COMPACT_POPOVER.body}>{open ? detail({ close }) : null}</div>
        </PopoverContent>
      )}
    </Popover>
  );
}
