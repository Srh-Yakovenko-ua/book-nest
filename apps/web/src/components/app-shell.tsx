"use client";

import type { ReactNode } from "react";

import {
  ArrowUpRight,
  BookCopy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleArrowDown,
  Feather,
  HandHelping,
  Heart,
  History,
  Home,
  Landmark,
  Layers,
  Library,
  LibraryBig,
  ListChecks,
  ListOrdered,
  NotebookPen,
  Quote,
  Settings,
  ShoppingBag,
  Tags,
  Truck,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect, useState } from "react";

import { LocalePicker } from "@/components/locale-picker";
import { SessionMenu } from "@/components/session-menu";
import { ThemePicker } from "@/components/theme-picker";
import { TooltipHint } from "@/components/tooltip-hint";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

type NavGroup = {
  icon: React.ElementType;
  items: readonly NavLink[];
  key: NavKey;
};

type NavItem = NavGroup | NavLink;

type NavKey =
  | "allBooks"
  | "buyList"
  | "dedications"
  | "delivery"
  | "favorites"
  | "genresTags"
  | "home"
  | "lists"
  | "loans"
  | "loansBorrowed"
  | "loansHistory"
  | "loansLent"
  | "myLibrary"
  | "notes"
  | "publishers"
  | "quotes"
  | "readingQueue"
  | "series"
  | "settings";

type NavLink = {
  icon: React.ElementType;
  key: NavKey;
  to: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { icon: Home, key: "home", to: "/" },
  { icon: LibraryBig, key: "allBooks", to: "/books" },
  { icon: Library, key: "myLibrary", to: "/my-library" },
  { icon: Heart, key: "favorites", to: "/favorites" },
  { icon: Quote, key: "quotes", to: "/quotes" },
  { icon: ListOrdered, key: "readingQueue", to: "/reading-queue" },
  { icon: ShoppingBag, key: "buyList", to: "/books-to-buy" },
  {
    icon: HandHelping,
    items: [
      { icon: CircleArrowDown, key: "loansBorrowed", to: "/loans/borrowed" },
      { icon: ArrowUpRight, key: "loansLent", to: "/loans/lent" },
      { icon: History, key: "loansHistory", to: "/loans/history" },
    ],
    key: "loans",
  },
  { icon: Truck, key: "delivery", to: "/delivery/in-transit" },
  { icon: Feather, key: "dedications", to: "/dedications" },
  { icon: BookCopy, key: "series", to: "/series" },
  { icon: Landmark, key: "publishers", to: "/publishers" },
  { icon: Tags, key: "genresTags", to: "/genres-tags" },
  { icon: ListChecks, key: "lists", to: "/lists" },
  { icon: NotebookPen, key: "notes", to: "/notes" },
  { icon: Settings, key: "settings", to: "/settings" },
];

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

function AppSidebar() {
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) =>
                "items" in item ? (
                  <NavGroupItem group={item} key={item.key} />
                ) : (
                  <NavLinkItem key={item.key} link={item} />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-0">
        <div className="flex items-center justify-end gap-2 px-3 py-3 group-data-[state=collapsed]:flex-col group-data-[state=collapsed]:justify-center">
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
            className="mx-auto block size-[150px] select-none lg:h-auto lg:w-4/5"
            height={500}
            priority={false}
            src="/illustrations/sidebar.png"
            width={500}
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

function NavGroupItem({ group }: { group: NavGroup }) {
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const { isMobile, state } = useSidebar();
  const hasActiveChild = group.items.some((item) => item.to === pathname);
  const [open, setOpen] = useState(hasActiveChild);
  const [wasOnChildPage, setWasOnChildPage] = useState(hasActiveChild);

  if (hasActiveChild !== wasOnChildPage) {
    setWasOnChildPage(hasActiveChild);
    if (hasActiveChild) setOpen(true);
  }

  if (!isMobile && state === "collapsed") {
    return group.items.map((item) => <NavLinkItem key={item.key} link={item} />);
  }

  const GroupIcon = group.icon;

  return (
    <Collapsible asChild onOpenChange={setOpen} open={open}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={cn(
              "cursor-pointer gap-3 transition-all duration-150",
              hasActiveChild
                ? "text-sidebar-active-foreground hover:bg-sidebar-accent hover:text-sidebar-active-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
            tooltip={tNav(group.key)}
          >
            <GroupIcon
              className={cn(
                "size-[18px] shrink-0 transition-colors duration-150",
                hasActiveChild ? "text-sidebar-active-foreground" : "text-sidebar-foreground/70",
              )}
            />
            <span className="font-mono text-[12px] font-medium tracking-[0.14em] uppercase">
              {tNav(group.key)}
            </span>
            <ChevronDown
              className={cn(
                "ml-auto size-4 shrink-0 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub className="mt-1 gap-1">
            {group.items.map(({ icon: ItemIcon, key, to }) => {
              const isActive = pathname === to;
              return (
                <SidebarMenuSubItem key={key}>
                  <SidebarMenuSubButton
                    asChild
                    className="h-8 cursor-pointer gap-2.5"
                    isActive={isActive}
                  >
                    <Link href={to}>
                      <ItemIcon className="size-4 shrink-0" />
                      <span className="font-mono text-[11px] font-medium tracking-[0.12em] uppercase">
                        {tNav(key)}
                      </span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function NavLinkItem({ link: { icon: LinkIcon, key, to } }: { link: NavLink }) {
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const isActive = pathname === to;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={cn(
          "relative cursor-pointer gap-3 transition-all duration-150",
          isActive
            ? "bg-primary/10 text-sidebar-active-foreground hover:bg-primary/15 hover:text-sidebar-active-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
        isActive={isActive}
        tooltip={tNav(key)}
      >
        <Link href={to}>
          <LinkIcon
            className={cn(
              "size-[18px] shrink-0 transition-colors duration-150",
              isActive ? "text-sidebar-active-foreground" : "text-sidebar-foreground/70",
            )}
          />
          <span className="font-mono text-[12px] font-medium tracking-[0.14em] uppercase">
            {tNav(key)}
          </span>
          {isActive && (
            <motion.div
              className="absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
              layoutId="sidebar-active-indicator"
              transition={{ damping: 34, stiffness: 420, type: "spring" }}
            />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
