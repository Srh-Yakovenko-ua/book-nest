"use client";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { PageTabsNav } from "@/components/page-tabs";

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

  return (
    <PageTabsNav
      ariaLabel={t("label")}
      items={SUBNAV_ITEMS.map((item) => ({
        href: item.href,
        icon: item.icon,
        label: t(item.key),
      }))}
    />
  );
}
