"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { ChevronDown, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect, useState } from "react";

import {
  APP_NAV,
  isNavChildActive,
  isNavItemActive,
  type NavLink,
  type NavSection,
} from "@/components/app-nav";
import { LocalePicker } from "@/components/locale-picker";
import { SessionMenu } from "@/components/session-menu";
import { ThemePicker } from "@/components/theme-picker";
import { TooltipHint } from "@/components/tooltip-hint";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NotificationBell } from "@/features/notifications";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavSectionToggle = {
  isOpen: boolean;
  pathname: string;
};

const NAV_STYLES = {
  activeIcon: "text-sidebar-active-foreground",
  chevron:
    "ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180",
  flyoutActiveChild: "bg-primary/10 text-sidebar-active-foreground",
  flyoutChild: "cursor-pointer text-[13px]",
  flyoutContent: "min-w-44",
  groupLabel:
    "font-mono text-[11px] font-medium tracking-[0.14em] text-sidebar-foreground/60 uppercase",
  icon: "size-[18px] shrink-0 transition-colors duration-150",
  idleIcon: "text-sidebar-foreground/70",
  idleItem: "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
  illustration: "mx-auto hidden size-[88px] shrink-0 select-none [@media(min-height:900px)]:block",
  item: "relative cursor-pointer gap-3 transition-all duration-150",
  label: "text-[13px] font-medium",
  subActiveChild: "bg-primary/10 text-sidebar-active-foreground hover:bg-primary/15",
  subChild: "cursor-pointer",
  subIdleChild: "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
  subIndicator:
    "absolute top-1/2 -left-[11px] h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary",
  subLabel: "truncate text-[13px]",
} as const;

const ACTIVE_INDICATOR_TRANSITION = { damping: 34, stiffness: 420, type: "spring" } as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <SidebarProvider>
        <AppSidebar />
        <ContentArea>{children}</ContentArea>
      </SidebarProvider>
    </NuqsAdapter>
  );
}

export function AppSidebar() {
  const t = useTranslations();
  const tShell = useTranslations("appShell");
  const pathname = usePathname();
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-4 py-5">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-200",
            collapsed && "justify-center gap-0",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 shadow-[var(--shadow-soft)]">
            <Layers className="size-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              {tShell("label")}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <NavMenuLink item={APP_NAV.home} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {APP_NAV.groups.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel className={NAV_STYLES.groupLabel}>
              {t(group.labelKey)}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label={t(group.labelKey)} className="gap-1">
                {group.items.map((item) =>
                  item.kind === "section" ? (
                    <NavSectionMenuItem item={item} key={item.pathPrefix} pathname={pathname} />
                  ) : (
                    <NavMenuLink item={item} key={item.to} pathname={pathname} />
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-0 border-t border-border/60 p-0">
        <SidebarMenu className="p-2">
          <NavMenuLink item={APP_NAV.settings} pathname={pathname} />
        </SidebarMenu>
        <div className="flex items-center justify-end gap-2 px-3 pb-3 group-data-[state=collapsed]:flex-col group-data-[state=collapsed]:justify-center">
          <button
            aria-label={collapsed ? tShell("expandSidebar") : tShell("collapseSidebar")}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground"
            onClick={toggleSidebar}
            type="button"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
        {!collapsed && (
          <Image
            alt=""
            className={NAV_STYLES.illustration}
            height={176}
            priority={false}
            src="/illustrations/sidebar.png"
            width={176}
          />
        )}
      </SidebarFooter>

      <TooltipHint label={collapsed ? tShell("expandSidebar") : tShell("collapseSidebar")}>
        <SidebarRail
          aria-label={collapsed ? tShell("expandSidebar") : tShell("collapseSidebar")}
          title={undefined}
        />
      </TooltipHint>
    </Sidebar>
  );
}

function ContentArea({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 15% 0%, oklch(from var(--primary) l c h / 0.07), transparent 60%),
            radial-gradient(ellipse 50% 60% at 92% 95%, oklch(from var(--info) l c h / 0.05), transparent 55%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.018]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <header className="sticky top-0 z-30 flex h-[var(--shell-header-height)] shrink-0 items-center gap-4 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex min-w-0 flex-1 items-center">
          <SidebarTrigger className="size-8 cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground lg:hidden" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <SessionMenu />
          <ThemePicker />
          <LocalePicker />
        </div>
      </header>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function NavMenuLink({ item, pathname }: { item: NavLink; pathname: string }) {
  const t = useTranslations();
  const label = t(item.labelKey);
  const isActive = isNavItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={cn(NAV_STYLES.item, !isActive && NAV_STYLES.idleItem)}
        isActive={isActive}
        tooltip={label}
      >
        <Link aria-current={isActive ? "page" : undefined} href={item.to}>
          <Icon
            className={cn(NAV_STYLES.icon, isActive ? NAV_STYLES.activeIcon : NAV_STYLES.idleIcon)}
          />
          <span className={NAV_STYLES.label}>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavSectionCollapsible({ item, pathname }: { item: NavSection; pathname: string }) {
  const t = useTranslations();
  const [toggle, setToggle] = useState<Nullable<NavSectionToggle>>(null);

  const label = t(item.labelKey);
  const isSectionActive = isNavItemActive(item, pathname);
  const isOpen = toggle?.pathname === pathname ? toggle.isOpen : isSectionActive;
  const Icon = item.icon;

  return (
    <Collapsible
      asChild
      onOpenChange={(open) => setToggle({ isOpen: open, pathname })}
      open={isOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={cn("group", NAV_STYLES.item, !isSectionActive && NAV_STYLES.idleItem)}
            isActive={isSectionActive}
          >
            <Icon
              className={cn(
                NAV_STYLES.icon,
                isSectionActive ? NAV_STYLES.activeIcon : NAV_STYLES.idleIcon,
              )}
            />
            <span className={NAV_STYLES.label}>{label}</span>
            <ChevronDown className={NAV_STYLES.chevron} />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub aria-label={t(item.subListLabelKey)} className="mt-1">
            {item.children.map((child) => {
              const isChildActive = isNavChildActive(child, pathname);

              return (
                <SidebarMenuSubItem key={child.to}>
                  <SidebarMenuSubButton
                    asChild
                    className={cn(
                      NAV_STYLES.subChild,
                      isChildActive ? NAV_STYLES.subActiveChild : NAV_STYLES.subIdleChild,
                    )}
                    isActive={isChildActive}
                  >
                    <Link aria-current={isChildActive ? "page" : undefined} href={child.to}>
                      <span className={NAV_STYLES.subLabel}>{t(child.labelKey)}</span>
                    </Link>
                  </SidebarMenuSubButton>
                  {isChildActive && (
                    <motion.div
                      className={NAV_STYLES.subIndicator}
                      layoutId="sidebar-active-sub-indicator"
                      transition={ACTIVE_INDICATOR_TRANSITION}
                    />
                  )}
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function NavSectionFlyout({ item, pathname }: { item: NavSection; pathname: string }) {
  const t = useTranslations();
  const label = t(item.labelKey);
  const isSectionActive = isNavItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            className={cn(NAV_STYLES.item, !isSectionActive && NAV_STYLES.idleItem)}
            isActive={isSectionActive}
          >
            <Icon
              className={cn(
                NAV_STYLES.icon,
                isSectionActive ? NAV_STYLES.activeIcon : NAV_STYLES.idleIcon,
              )}
            />
            <span className={NAV_STYLES.label}>{label}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={NAV_STYLES.flyoutContent}
          side="right"
          sideOffset={8}
        >
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {item.children.map((child) => {
            const isChildActive = isNavChildActive(child, pathname);

            return (
              <DropdownMenuItem asChild key={child.to}>
                <Link
                  aria-current={isChildActive ? "page" : undefined}
                  className={cn(
                    NAV_STYLES.flyoutChild,
                    isChildActive && NAV_STYLES.flyoutActiveChild,
                  )}
                  href={child.to}
                >
                  {t(child.labelKey)}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function NavSectionMenuItem({ item, pathname }: { item: NavSection; pathname: string }) {
  const { isMobile, state } = useSidebar();

  if (state === "collapsed" && !isMobile) {
    return <NavSectionFlyout item={item} pathname={pathname} />;
  }

  return <NavSectionCollapsible item={item} pathname={pathname} />;
}
