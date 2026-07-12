import { create } from "zustand";

type LibrarySelectionState = {
  clear: () => void;
  enterSelection: () => void;
  exitSelection: () => void;
  selectedIds: Set<string>;
  selectionMode: boolean;
  setAvailable: (ids: string[]) => void;
  toggle: (id: string) => void;
};

export const useLibrarySelectionStore = create<LibrarySelectionState>((set) => ({
  clear: () =>
    set((state) => (state.selectedIds.size === 0 ? state : { selectedIds: new Set<string>() })),
  enterSelection: () => set({ selectionMode: true }),
  exitSelection: () => set({ selectedIds: new Set<string>(), selectionMode: false }),
  selectedIds: new Set<string>(),
  selectionMode: false,
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
