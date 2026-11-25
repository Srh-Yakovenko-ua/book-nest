import type { UpdateSettingsInput } from "@app/shared";
import type { MutationStatus } from "@tanstack/react-query";

import { useUpdateSettings } from "../api/use-update-settings";

export type AutosaveField<TValue extends AutosaveValue> = {
  retry: () => void;
  save: (next: TValue) => void;
  status: AutosaveStatus;
  value: TValue;
};

export type AutosaveStatus = "error" | "idle" | "saved" | "saving";

type AutosaveFieldOptions<TValue extends AutosaveValue> = {
  confirmed: TValue;
  fromInput: (input: UpdateSettingsInput) => TValue | undefined;
  toInput: (value: TValue) => UpdateSettingsInput;
};

type AutosaveValue = boolean | number | string;

const AUTOSAVE_STATUS = {
  error: "error",
  idle: "idle",
  pending: "saving",
  success: "saved",
} as const satisfies Record<MutationStatus, AutosaveStatus>;

export function useAutosaveField<TValue extends AutosaveValue>({
  confirmed,
  fromInput,
  toInput,
}: AutosaveFieldOptions<TValue>): AutosaveField<TValue> {
  const mutation = useUpdateSettings();

  const pendingValue =
    mutation.isPending && mutation.variables ? fromInput(mutation.variables) : undefined;
  const value = pendingValue ?? confirmed;

  function save(next: TValue) {
    if (mutation.isPending) return;
    if (next === value) return;
    mutation.mutate(toInput(next));
  }

  function retry() {
    if (!mutation.isError) return;
    mutation.mutate(mutation.variables);
  }

  return { retry, save, status: AUTOSAVE_STATUS[mutation.status], value };
}
