"use client";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type DeliverySubnavItem = {
  href: string;
  icon: UiIconName;
  key: "history" | "inTransit" | "statistics";
};

const SUBNAV_ITEMS: readonly DeliverySubnavItem[] = [
  { href: "/delivery/in-transit", icon: "truck", key: "inTransit" },
  { href: "/delivery/history", icon: "list", key: "history" },
  { href: "/delivery/statistics", icon: "chart", key: "statistics" },
];

export function DeliverySubnav() {
  const t = useTranslations("delivery.subnav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-1 no-scrollbar overflow-x-auto px-1">
      <div className="inline-flex w-max items-center gap-1 rounded-full border border-border bg-field p-1">
        {SUBNAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "bg-card text-ink shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
              href={item.href}
              key={item.key}
            >
              <UiIcon name={item.icon} size={16} />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
