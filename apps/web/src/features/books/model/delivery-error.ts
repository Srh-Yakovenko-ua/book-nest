import { DELIVERY_ERROR_CODES } from "@app/shared";

import { HTTP_STATUS } from "@/lib/api-errors";
import { ApiError } from "@/lib/http-client";

export type DeliveryErrorKey =
  | "bookAlreadyOrdered"
  | "bookNotOrderable"
  | "expectedBeforeOrder"
  | "generic"
  | "itemAlreadyCancelled"
  | "itemAlreadyReceived"
  | "itemNoLongerActive"
  | "itemsNotMovable"
  | "notFound"
  | "sharedOrder"
  | "sharedShipment"
  | "shipmentNotActive";

export function toDeliveryErrorKey(error: unknown): DeliveryErrorKey {
  if (!(error instanceof ApiError)) return "generic";

  switch (error.code) {
    case DELIVERY_ERROR_CODES.bookAlreadyOrdered:
      return "bookAlreadyOrdered";
    case DELIVERY_ERROR_CODES.bookNotOrderable:
      return "bookNotOrderable";
    case DELIVERY_ERROR_CODES.expectedBeforeOrderDate:
      return "expectedBeforeOrder";
    case DELIVERY_ERROR_CODES.itemAlreadyCancelled:
      return "itemAlreadyCancelled";
    case DELIVERY_ERROR_CODES.itemAlreadyReceived:
      return "itemAlreadyReceived";
    case DELIVERY_ERROR_CODES.itemNoLongerActive:
      return "itemNoLongerActive";
    case DELIVERY_ERROR_CODES.itemsNotMovable:
      return "itemsNotMovable";
    case DELIVERY_ERROR_CODES.sharedOrder:
      return "sharedOrder";
    case DELIVERY_ERROR_CODES.sharedShipment:
      return "sharedShipment";
    case DELIVERY_ERROR_CODES.shipmentNotActive:
      return "shipmentNotActive";
    default:
      break;
  }

  return error.status === HTTP_STATUS.notFound ? "notFound" : "generic";
}
