"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import type { LibraryActions } from "../model/book-card-actions";

import {
  useBulkAddTags,
  useBulkAddToList,
  useBulkAddToReadingQueue,
  useBulkDeleteBooks,
  useBulkOwnershipStatus,
  useBulkReadingStatus,
  useBulkSetFavorite,
  useRemoveFromReadingQueue,
  useToggleFavorite,
} from "../api/use-book-actions";

export function useLibraryActions(): LibraryActions {
  const t = useTranslations("books.library");
  const router = useRouter();

  const toggleFavorite = useToggleFavorite();
  const setFavorite = useBulkSetFavorite();
  const changeReadingStatus = useBulkReadingStatus();
  const changeOwnership = useBulkOwnershipStatus();
  const addToList = useBulkAddToList();
  const addTags = useBulkAddTags();
  const addToQueue = useBulkAddToReadingQueue();
  const removeFromQueue = useRemoveFromReadingQueue();
  const deleteBooks = useBulkDeleteBooks();

  async function runWithToast(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(t("toast.error"));
      throw error;
    }
  }

  return {
    onAddTags: (input) => runWithToast(() => addTags.mutateAsync(input), t("toast.tagsAdded")),
    onAddToList: (input) =>
      runWithToast(() => addToList.mutateAsync(input), t("toast.addedToList")),
    onAddToQueue: (bookIds) =>
      runWithToast(() => addToQueue.mutateAsync(bookIds), t("toast.queueAdded")),
    onChangeOwnership: (input) =>
      runWithToast(() => changeOwnership.mutateAsync(input), t("toast.ownershipChanged")),
    onChangeReadingStatus: (input) =>
      runWithToast(() => changeReadingStatus.mutateAsync(input), t("toast.readingStatusChanged")),
    onDelete: (bookIds) =>
      runWithToast(
        () => deleteBooks.mutateAsync(bookIds),
        t("toast.deleted", { count: bookIds.length }),
      ),
    onEdit: (bookId) => router.push(`/books/${bookId}/edit`),
    onRemoveFromQueue: (id) =>
      runWithToast(() => removeFromQueue.mutateAsync(id), t("toast.queueRemoved")),
    onSetFavorite: (input) =>
      runWithToast(
        () => setFavorite.mutateAsync(input),
        input.isFavorite ? t("toast.favoriteAdded") : t("toast.favoriteRemoved"),
      ),
    onToggleFavorite: ({ id, isFavorite }) =>
      toggleFavorite.mutate(
        { id, isFavorite },
        {
          onError: () => toast.error(t("toast.error")),
          onSuccess: () =>
            toast.success(isFavorite ? t("toast.favoriteAdded") : t("toast.favoriteRemoved")),
        },
      ),
  };
}
