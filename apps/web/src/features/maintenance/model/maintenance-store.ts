import { create } from "zustand";

type MaintenanceState = {
  active: boolean;
  end: () => void;
  start: () => void;
};

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  active: false,
  end: () => set((state) => (state.active ? { active: false } : state)),
  start: () => set((state) => (state.active ? state : { active: true })),
}));

export function reportMaintenance(): void {
  useMaintenanceStore.getState().start();
}
