import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Label } from "@/components/ui/label";
import { Rating } from "@/components/ui/rating";
import { Segmented } from "@/components/ui/segmented";

import { FilterPanel, FilterSection } from "./filter-panel";

const STATUSES = [
  { label: "Хочу прочитати", value: "want_to_read" },
  { label: "Читаю", value: "reading" },
  { label: "Прочитано", value: "finished" },
] as const;

const GENRES = [
  { label: "Фентезі", value: "fantasy" },
  { label: "Трилер", value: "thriller" },
  { label: "Романтика", value: "romance" },
  { label: "Нон-фікшн", value: "nonfiction" },
] as const;

function Demo() {
  const [statuses, setStatuses] = useState<string[]>(["reading"]);
  const [genres, setGenres] = useState<string[]>(["fantasy"]);
  const [minRating, setMinRating] = useState(4);
  const [sort, setSort] = useState("recent");

  function clear() {
    setStatuses([]);
    setGenres([]);
    setMinRating(0);
  }

  return (
    <FilterPanel
      footer={
        <Button className="w-full" size="lg">
          Показати результати
        </Button>
      }
      onClear={clear}
      onClose={() => undefined}
    >
      <FilterSection title="Статус читання">
        {STATUSES.map((status) => {
          const checked = statuses.includes(status.value);
          return (
            <Label
              className="flex items-center gap-2.5 py-1 text-sm font-normal"
              key={status.value}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) =>
                  setStatuses((prev) =>
                    next ? [...prev, status.value] : prev.filter((v) => v !== status.value),
                  )
                }
              />
              {status.label}
            </Label>
          );
        })}
      </FilterSection>

      <FilterSection title="Жанри">
        <ChipGroup
          mode="multi"
          onValueChange={setGenres}
          options={GENRES}
          size="sm"
          value={genres}
        />
      </FilterSection>

      <FilterSection title="Мінімальний рейтинг">
        <Rating onValueChange={setMinRating} value={minRating} />
      </FilterSection>

      <FilterSection title="Сортування">
        <Segmented
          block
          onValueChange={setSort}
          options={[
            { label: "Нові", value: "recent" },
            { label: "Рейтинг", value: "rating" },
          ]}
          value={sort}
        />
      </FilterSection>
    </FilterPanel>
  );
}

const meta = {
  component: FilterPanel,
  tags: ["ai-generated"],
  title: "UI/FilterPanel",
} satisfies Meta<typeof FilterPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Фільтри")).toBeVisible();
    await expect(canvas.getByText("Статус читання")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Скинути всі" })).toBeVisible();
  },
};
