import { CHARACTER_CUSTOM_LABELS_MAX } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type {
  CharacterCustomLabelsRepository,
  CustomLabelUsage,
  CustomLabelUsageRow,
} from "../infrastructure/character-custom-labels.repository.js";

import { CharacterCustomLabelsService } from "./character-custom-labels.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function getCustomLabels(usage: Partial<CustomLabelUsage>) {
  return setup(usage).service.getCustomLabels({ userId: USER_ID });
}

function numberedRows({ count, prefix }: { count: number; prefix: string }): CustomLabelUsageRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    count: index + 1,
    label: `${prefix} ${String(index + 1)}`,
  }));
}

function setup(usage: Partial<CustomLabelUsage>) {
  const findCustomLabelUsage = vi.fn().mockResolvedValue({ roles: [], statuses: [], ...usage });
  const service = new CharacterCustomLabelsService({
    findCustomLabelUsage,
  } as unknown as CharacterCustomLabelsRepository);

  return { findCustomLabelUsage, service };
}

describe("CharacterCustomLabelsService.getCustomLabels", () => {
  it("reads only the requesting user's usage", async () => {
    const { findCustomLabelUsage, service } = setup({});

    await service.getCustomLabels({ userId: USER_ID });

    expect(findCustomLabelUsage).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it("returns empty lists when the user has no custom labels", async () => {
    await expect(getCustomLabels({})).resolves.toEqual({ roles: [], statuses: [] });
  });

  it("merges role spellings that differ by case and whitespace and sums their counts", async () => {
    const result = await getCustomLabels({
      roles: [
        { count: 3, label: "Наставник" },
        { count: 1, label: "наставник " },
        { count: 1, label: "  НАСТАВНИК" },
      ],
    });

    expect(result.roles).toEqual([{ count: 5, label: "Наставник" }]);
  });

  it("merges spellings that differ only by inner whitespace runs", async () => {
    const result = await getCustomLabels({
      statuses: [
        { count: 1, label: "Зник  безвісти" },
        { count: 2, label: "зник безвісти" },
      ],
    });

    expect(result.statuses).toEqual([{ count: 3, label: "зник безвісти" }]);
  });

  it("displays the most used spelling of a group, trimmed", async () => {
    const result = await getCustomLabels({
      roles: [
        { count: 1, label: "Наставник" },
        { count: 4, label: "  наставник  " },
      ],
    });

    expect(result.roles).toEqual([{ count: 5, label: "наставник" }]);
  });

  it("breaks a spelling tie deterministically regardless of input order", async () => {
    const forward = await getCustomLabels({
      roles: [
        { count: 2, label: "наставник" },
        { count: 2, label: "Наставник" },
      ],
    });
    const reversed = await getCustomLabels({
      roles: [
        { count: 2, label: "Наставник" },
        { count: 2, label: "наставник" },
      ],
    });

    expect(forward.roles).toEqual([{ count: 4, label: "Наставник" }]);
    expect(reversed.roles).toEqual(forward.roles);
  });

  it("sorts by usage count descending, then by label in Ukrainian alphabetical order", async () => {
    const result = await getCustomLabels({
      roles: [
        { count: 1, label: "Їжак" },
        { count: 1, label: "Явір" },
        { count: 5, label: "Суддя" },
        { count: 1, label: "Блазень" },
      ],
    });

    expect(result.roles).toEqual([
      { count: 5, label: "Суддя" },
      { count: 1, label: "Блазень" },
      { count: 1, label: "Їжак" },
      { count: 1, label: "Явір" },
    ]);
  });

  it("drops blank labels", async () => {
    const result = await getCustomLabels({
      roles: [
        { count: 2, label: "   " },
        { count: 1, label: "Свідок" },
      ],
      statuses: [{ count: 3, label: "" }],
    });

    expect(result).toEqual({ roles: [{ count: 1, label: "Свідок" }], statuses: [] });
  });

  it("keeps roles and statuses apart even when they share a label", async () => {
    const result = await getCustomLabels({
      roles: [{ count: 2, label: "Вигнанець" }],
      statuses: [{ count: 1, label: "вигнанець" }],
    });

    expect(result).toEqual({
      roles: [{ count: 2, label: "Вигнанець" }],
      statuses: [{ count: 1, label: "вигнанець" }],
    });
  });

  it("caps each list at its maximum, keeping the most used labels", async () => {
    const overflow = 5;
    const result = await getCustomLabels({
      roles: numberedRows({ count: CHARACTER_CUSTOM_LABELS_MAX.roles + overflow, prefix: "Роль" }),
      statuses: numberedRows({
        count: CHARACTER_CUSTOM_LABELS_MAX.statuses + overflow,
        prefix: "Стан",
      }),
    });

    expect(result.roles).toHaveLength(CHARACTER_CUSTOM_LABELS_MAX.roles);
    expect(result.statuses).toHaveLength(CHARACTER_CUSTOM_LABELS_MAX.statuses);
    expect(result.roles[0]).toEqual({
      count: CHARACTER_CUSTOM_LABELS_MAX.roles + overflow,
      label: `Роль ${String(CHARACTER_CUSTOM_LABELS_MAX.roles + overflow)}`,
    });
    expect(result.roles.some((role) => role.count <= overflow)).toBe(false);
  });
});
