import type {
  AddBooksToListInput,
  AddBooksToListResult,
  CustomListDetail,
  MoveListBookDirection,
} from "@app/shared";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { AddBooksToListResultSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import {
  listMembershipControllerAddBooks,
  listMembershipControllerMoveBook,
  listMembershipControllerRemoveBook,
} from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

type MoveContext = {
  snapshot: [QueryKey, InfiniteData<CustomListDetail> | undefined][];
};

export function useAddBooksToList(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddBooksToListInput): Promise<AddBooksToListResult> =>
      AddBooksToListResultSchema.parse(await listMembershipControllerAddBooks(listId, input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}

export function useMoveListBook(listId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { bookId: string; direction: MoveListBookDirection },
    MoveContext
  >({
    mutationFn: ({ bookId, direction }) =>
      listMembershipControllerMoveBook(listId, bookId, { direction }),
    onError: (_error, _input, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onMutate: async ({ bookId, direction }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.detail(listId) });
      const snapshot = queryClient.getQueriesData<InfiniteData<CustomListDetail>>({
        queryKey: listKeys.detail(listId),
      });
      for (const [key, data] of snapshot) {
        if (data === undefined) continue;
        queryClient.setQueryData<InfiniteData<CustomListDetail>>(
          key,
          moveBookInDetail(data, bookId, direction),
        );
      }
      return { snapshot };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

export function useRemoveBookFromList(listId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId: string) => listMembershipControllerRemoveBook(listId, bookId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listKeys.detail(listId) });
      void queryClient.invalidateQueries({ queryKey: listKeys.root });
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    },
  });
}

function moveBookInDetail(
  data: InfiniteData<CustomListDetail>,
  bookId: string,
  direction: MoveListBookDirection,
): InfiniteData<CustomListDetail> {
  const flat = data.pages.flatMap((page) => page.books.items);
  const index = flat.findIndex((book) => book.id === bookId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= flat.length) return data;

  const reordered = [...flat];
  const moved = reordered[index];
  const neighbor = reordered[targetIndex];
  if (moved === undefined || neighbor === undefined) return data;
  reordered[index] = { ...neighbor, position: moved.position };
  reordered[targetIndex] = { ...moved, position: neighbor.position };

  let cursor = 0;
  const pages = data.pages.map((page) => {
    const size = page.books.items.length;
    const items = reordered.slice(cursor, cursor + size);
    cursor += size;
    return { ...page, books: { ...page.books, items } };
  });

  return { ...data, pages };
}
