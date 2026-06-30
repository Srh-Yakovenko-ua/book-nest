import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { UiIcon } from "@/components/icons";

import { Button } from "./button";
import { CharacterCard } from "./character-card";

const BOOK = "Дім солі та смутку";

function Actions({ favourite = false }: { favourite?: boolean }) {
  return (
    <>
      <Button
        aria-label="Улюблене"
        className={favourite ? "text-error" : undefined}
        size="icon-sm"
        variant="ghost"
      >
        <UiIcon name="heart" size={18} />
      </Button>
      <Button aria-label="Ще" size="icon-sm" variant="ghost">
        <UiIcon name="more" size={18} />
      </Button>
    </>
  );
}

const meta = {
  args: {
    actions: <Actions favourite />,
    bookTitle: BOOK,
    description:
      "Молодший син прибережного роду, що приховує рідкісний дар. Розривається між обов'язком перед родиною та власним покликанням.",
    name: "Елайджа Кравен",
    role: { label: "Головний герой", variant: "primary" },
    traits: ["Загадковий", "Відданий", "Впертий"],
  },
  component: CharacterCard,
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
  tags: ["ai-generated"],
  title: "UI/CharacterCard",
} satisfies Meta<typeof CharacterCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Protagonist: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Елайджа Кравен")).toBeVisible();
    await expect(canvas.getByText("Головний герой")).toBeVisible();
    await expect(canvas.getByText("Загадковий")).toBeVisible();
  },
};

export const Mentor: Story = {
  args: {
    actions: <Actions />,
    description:
      "Стара травниця з маяка, яка перша помічає Елайджин дар і навчає його слухати море.",
    name: "Мірра Венн",
    role: { label: "Наставниця", variant: "info" },
    traits: ["Мудра", "Прямолінійна"],
  },
};

export const Antagonist: Story = {
  args: {
    actions: <Actions />,
    description:
      "Насправді — зниклий брат Мірри, що уклав угоду з морськими глибинами заради безсмертя.",
    name: "Капітан Сорн",
    role: { label: "Антагоніст", variant: "destructive" },
    traits: ["Жорстокий", "Розрахунковий"],
  },
};

export const Roles: Story = {
  decorators: [
    (Story) => (
      <div className="grid w-[800px] grid-cols-2 gap-[18px]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <CharacterCard
        actions={<Actions favourite />}
        bookTitle={BOOK}
        description="Молодший син прибережного роду, що приховує рідкісний дар."
        name="Елайджа Кравен"
        role={{ label: "Головний герой", variant: "primary" }}
        traits={["Загадковий", "Відданий"]}
      />
      <CharacterCard
        actions={<Actions />}
        bookTitle={BOOK}
        description="Зниклий брат Мірри, що уклав угоду з морськими глибинами."
        name="Капітан Сорн"
        role={{ label: "Антагоніст", variant: "destructive" }}
        traits={["Жорстокий", "Розрахунковий"]}
      />
    </>
  ),
};
