import { create } from "zustand";

type LibrarySelectionState = {
  clear: () => void;
  selectedIds: Set<string>;
  setAvailable: (ids: string[]) => void;
  toggle: (id: string) => void;
};

export const useLibrarySelectionStore = create<LibrarySelectionState>((set) => ({
  clear: () =>
    set((state) => (state.selectedIds.size === 0 ? state : { selectedIds: new Set<string>() })),
  selectedIds: new Set<string>(),
  setAvailable: (ids) =>
    set((state) => {
      if (state.selectedIds.size === 0) return state;
      const available = new Set(ids);
      const next = new Set<string>();
      for (const id of state.selectedIds) {
        if (available.has(id)) next.add(id);
      }
      return next.size === state.selectedIds.size ? state : { selectedIds: next };
    }),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
}));
