import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("../", import.meta.url));

const MODULES_ROOT = resolve(SRC_ROOT, "modules");

const KNOWN_IMPORT_KNOT = ["books", "loans", "series"];

const EDGE_PATTERN = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;'"]*?["']([^"']+)["']/g;

function buildImportGraph(files: Set<string>): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const targets = new Set<string>();
    for (const match of readFileSync(file, "utf8").matchAll(EDGE_PATTERN)) {
      const specifier = match[1];
      if (specifier === undefined || !specifier.startsWith(".")) {
        continue;
      }
      const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
      if (files.has(target)) {
        targets.add(target);
      }
    }
    graph.set(file, [...targets]);
  }
  return graph;
}

function collectSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "generated") {
        collectSourceFiles(path, found);
      }
      continue;
    }
    if (path.endsWith(".ts") && !path.endsWith(".d.ts")) {
      found.push(path);
    }
  }
  return found;
}

function findCyclicComponents(graph: Map<string, string[]>): string[][] {
  const order = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  const visit = (node: string): void => {
    order.set(node, counter);
    lowLink.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!order.has(next)) {
        visit(next);
        lowLink.set(node, Math.min(lowLink.get(node) ?? 0, lowLink.get(next) ?? 0));
        continue;
      }
      if (onStack.has(next)) {
        lowLink.set(node, Math.min(lowLink.get(node) ?? 0, order.get(next) ?? 0));
      }
    }

    if (lowLink.get(node) !== order.get(node)) {
      return;
    }
    const component: string[] = [];
    for (;;) {
      const member = stack.pop();
      if (member === undefined) {
        break;
      }
      onStack.delete(member);
      component.push(member);
      if (member === node) {
        break;
      }
    }
    if (component.length > 1) {
      components.push(component);
    }
  };

  for (const node of graph.keys()) {
    if (!order.has(node)) {
      visit(node);
    }
  }
  return components;
}

function toFeatureModule(file: string): null | string {
  const withinModules = relative(MODULES_ROOT, file);
  if (withinModules.startsWith("..")) {
    return null;
  }
  return withinModules.split("/")[0] ?? null;
}

describe("import cycles", () => {
  it("keeps every feature module outside the known books/loans/series knot", () => {
    const files = new Set(collectSourceFiles(SRC_ROOT));
    const components = findCyclicComponents(buildImportGraph(files));
    const tangled = new Set(
      components.flat().flatMap((file) => {
        const feature = toFeatureModule(file);
        return feature === null ? [] : [feature];
      }),
    );

    expect([...tangled].sort()).toEqual(KNOWN_IMPORT_KNOT);
  });
});
