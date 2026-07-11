"use client";

import type { ReactNode } from "react";

import {
  BookCopy,
  ChevronLeft,
  ChevronRight,
  HandHelping,
  Heart,
  Home,
  Layers,
  Library,
  LibraryBig,
  ListChecks,
  ListOrdered,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect } from "react";

import { LocalePicker } from "@/components/locale-picker";
import { SessionMenu } from "@/components/session-menu";
import { ThemePicker } from "@/components/theme-picker";
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChangelogBell } from "@/features/changelog";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  icon: React.ElementType;
  key:
    | "allBooks"
    | "buyList"
    | "delivery"
    | "favorites"
    | "home"
    | "lists"
    | "loans"
    | "myLibrary"
    | "readingQueue"
    | "series";
  to: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: Home, key: "home", to: "/" },
  { icon: Library, key: "myLibrary", to: "/my-library" },
  { icon: Heart, key: "favorites", to: "/favorites" },
  { icon: ListOrdered, key: "readingQueue", to: "/reading-queue" },
  { icon: LibraryBig, key: "allBooks", to: "/books" },
  { icon: ShoppingBag, key: "buyList", to: "/books-to-buy" },
  { icon: HandHelping, key: "loans", to: "/loans" },
  { icon: Truck, key: "delivery", to: "/delivery/in-transit" },
  { icon: BookCopy, key: "series", to: "/series" },
  { icon: ListChecks, key: "lists", to: "/lists" },
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
  const tNav = useTranslations("nav");
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
              {NAV_ITEMS.map(({ icon: Icon, key, to }) => {
                const isActive = pathname === to;
                return (
                  <SidebarMenuItem key={key}>
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
                        <Icon
                          className={cn(
                            "size-[18px] shrink-0 transition-colors duration-150",
                            isActive
                              ? "text-sidebar-active-foreground"
                              : "text-sidebar-foreground/70",
                          )}
                        />
                        <span className="font-mono text-[14px] font-medium tracking-[0.14em] uppercase">
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
              })}
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
            className="h-auto w-full select-none"
            height={500}
            priority={false}
            src="/illustrations/sidebar.png"
            width={500}
          />
        )}
      </SidebarFooter>

      <SidebarRail />
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
          <ChangelogBell />
          <SessionMenu />
          <ThemePicker />
          <LocalePicker />
        </div>
      </header>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
