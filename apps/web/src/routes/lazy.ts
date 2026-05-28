import type { ComponentType } from "react";

type ModuleWith<T extends string> = Record<T, ComponentType>;

export function lazyComponent<T extends string>(
  importer: () => Promise<ModuleWith<T>>,
  exportName: T,
) {
  return async () => ({ Component: (await importer())[exportName] });
}
