const DELIVERY_SERVICES_ROOT = "/api/delivery-services";

export const deliveryServiceKeys = {
  recent: [DELIVERY_SERVICES_ROOT, "recent"] as const,
  search: (search: string) => [DELIVERY_SERVICES_ROOT, "search", search] as const,
};
