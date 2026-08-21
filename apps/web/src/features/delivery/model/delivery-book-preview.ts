import type { DeliveryBookPreview } from "@app/shared";

export type DeliveryBookPreviewModel = {
  authorName: string;
  bookHref: string;
  coverSrc?: string;
  id: string;
  title: string;
};

export const DELIVERY_BOOK_PREVIEW = {
  coversMax: 3,
} as const;

export function toDeliveryBookPreviewModel(preview: DeliveryBookPreview): DeliveryBookPreviewModel {
  return {
    authorName: preview.authorName,
    bookHref: `/books/${preview.id}`,
    coverSrc: preview.cover?.urls.thumb,
    id: preview.id,
    title: preview.title,
  };
}
