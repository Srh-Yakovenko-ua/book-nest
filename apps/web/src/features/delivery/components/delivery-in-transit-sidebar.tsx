"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { DeliveryNextShipmentCardModel } from "../model/next-shipment-card";

import { DeliveryNextShipmentCard } from "./delivery-next-shipment-card";

type DeliveryInTransitSidebarProps = {
  isLoading: boolean;
  nextShipment: Nullable<DeliveryNextShipmentCardModel>;
  onRevealNextShipment: () => void;
  revealResetsFilters: boolean;
};

export function DeliveryInTransitSidebar({
  isLoading,
  nextShipment,
  onRevealNextShipment,
  revealResetsFilters,
}: DeliveryInTransitSidebarProps) {
  const t = useTranslations("delivery.sidebar");

  return (
    <aside
      aria-label={t("title")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <DeliveryNextShipmentCard
        isLoading={isLoading}
        model={nextShipment}
        onReveal={onRevealNextShipment}
        resetsFilters={revealResetsFilters}
      />
    </aside>
  );
}
