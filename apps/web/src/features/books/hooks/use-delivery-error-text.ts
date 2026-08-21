"use client";

import { useTranslations } from "next-intl";

import { toDeliveryErrorKey } from "../model/delivery-error";

export function useDeliveryErrorText(): (error: unknown) => string {
  const t = useTranslations("books.details.delivery.errors");
  return (error) => t(toDeliveryErrorKey(error));
}
