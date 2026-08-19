"use client";

import type {
  InTransitAttention,
  InTransitAttentionReason,
  InTransitImpact,
  Nullable,
} from "@app/shared";

import { useTranslations } from "next-intl";

import type { DeliveryNextShipmentCardModel } from "../model/next-shipment-card";

import { DeliveryAttentionBlock } from "./delivery-attention-block";
import { DeliveryImpactBlock } from "./delivery-impact-block";
import { DeliveryNextShipmentCard } from "./delivery-next-shipment-card";

type DeliveryInTransitSidebarProps = {
  activeAttentionReason: Nullable<InTransitAttentionReason>;
  attention: readonly InTransitAttention[];
  impact: readonly InTransitImpact[];
  isLoading: boolean;
  nextShipment: Nullable<DeliveryNextShipmentCardModel>;
  onAttentionSelect: (reason: InTransitAttentionReason) => void;
  onRevealNextShipment: () => void;
  revealResetsFilters: boolean;
};

export function DeliveryInTransitSidebar({
  activeAttentionReason,
  attention,
  impact,
  isLoading,
  nextShipment,
  onAttentionSelect,
  onRevealNextShipment,
  revealResetsFilters,
}: DeliveryInTransitSidebarProps) {
  const t = useTranslations("delivery.sidebar");

  return (
    <aside
      aria-label={t("title")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <DeliveryAttentionBlock
        activeReason={activeAttentionReason}
        attention={attention}
        isLoading={isLoading}
        onSelect={onAttentionSelect}
      />
      <DeliveryImpactBlock impact={impact} />
      <DeliveryNextShipmentCard
        isLoading={isLoading}
        model={nextShipment}
        onReveal={onRevealNextShipment}
        resetsFilters={revealResetsFilters}
      />
    </aside>
  );
}
