import type {
  Nullable,
  OwnSpeciesView,
  SpeciesCandidates,
  SpeciesDeletionPreview,
  SpeciesOptionView,
} from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Label } from "@/components/ui/label";
import { getQueryClient } from "@/lib/query-client";

import type { SpeciesSelection } from "../model/species-selection";

import { applyOwnSpeciesChange } from "../model/own-species-change";
import { ManageOwnSpeciesButton } from "./manage-own-species-button";
import { SpeciesPicker } from "./species-picker";

type SpeciesMock = {
  candidates?: Record<string, SpeciesCandidates>;
  createStatus?: 201 | 409;
  own?: OwnSpeciesView[];
  preview?: SpeciesDeletionPreview;
  searchStatus?: 200 | 500;
};

const CATEGORY = {
  bloodshifters: { key: "bloodshifters", name: "Вампіри та перевертні" },
  elven: { key: "elven", name: "Ельфи та споріднені" },
  humanoid: { key: "humanoid", name: "Люди та людиноподібні" },
  mythical: { key: "mythical", name: "Дракони та міфічні істоти" },
  smallfolk: { key: "smallfolk", name: "Гноми, гобліни та малі народи" },
} as const;

const SPECIES = {
  darkElf: system(
    "00000000-0000-4000-8000-000000000006",
    "dark_elf",
    "Темний ельф",
    CATEGORY.elven,
  ),
  dragon: system("00000000-0000-4000-8000-000000000005", "dragon", "Дракон", CATEGORY.mythical),
  dwarf: system("00000000-0000-4000-8000-000000000003", "dwarf", "Дворф", CATEGORY.smallfolk),
  elf: system("00000000-0000-4000-8000-000000000002", "elf", "Ельф", CATEGORY.elven),
  halfElf: system("00000000-0000-4000-8000-000000000007", "half_elf", "Напівельф", CATEGORY.elven),
  human: system("00000000-0000-4000-8000-000000000001", "human", "Людина", CATEGORY.humanoid),
  sandworm: own("00000000-0000-4000-8000-000000000009", "Шаї-Хулуд"),
  vampire: system(
    "00000000-0000-4000-8000-000000000004",
    "vampire",
    "Вампір",
    CATEGORY.bloodshifters,
  ),
  witcher: own("00000000-0000-4000-8000-000000000008", "Відьмак"),
} as const satisfies Record<string, SpeciesOptionView>;

const POPULAR = [
  SPECIES.human,
  SPECIES.elf,
  SPECIES.dwarf,
  SPECIES.vampire,
  SPECIES.dragon,
  SPECIES.witcher,
];

const CATALOG = Object.values(SPECIES);

const NO_CANDIDATES = { exact: null, similar: [] } as const satisfies SpeciesCandidates;

const STORY = {
  label: "Вид",
  placeholder: "Пошук, наприклад «ельф»",
  retryTimeoutMs: 5000,
} as const;

function Harness({ initial = null }: { initial?: Nullable<SpeciesSelection> }) {
  const [value, setValue] = useState<Nullable<SpeciesSelection>>(initial);

  return (
    <div className="flex w-80 max-w-full flex-col gap-2">
      <Label htmlFor="story-species">{STORY.label}</Label>
      <SpeciesPicker
        inputId="story-species"
        label={STORY.label}
        onChange={setValue}
        placeholder={STORY.placeholder}
        value={value}
      />
      <ManageOwnSpeciesButton
        onSpeciesChange={(change) => setValue((current) => applyOwnSpeciesChange(current, change))}
      />
      <p className="text-xs text-muted-foreground" data-testid="selection">
        {value === null ? "none" : `${value.id}:${value.label}`}
      </p>
    </div>
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockSpecies({
  candidates = {},
  createStatus = 201,
  own: ownSpecies = [],
  preview = { bookOverrides: 0, canDelete: true, characters: 0, trashed: 0 },
  searchStatus = 200,
}: SpeciesMock) {
  getQueryClient().clear();
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";

    if (url.pathname === "/api/species" && method === "POST") {
      const body: unknown = JSON.parse(String(init?.body ?? "{}"));
      const name =
        typeof body === "object" && body !== null && "name" in body ? String(body.name) : "";
      if (createStatus === 409) {
        return Promise.resolve(
          jsonResponse(409, {
            code: "species_duplicate",
            details: { species: SPECIES.sandworm },
            message: "A species with this name already exists",
          }),
        );
      }
      return Promise.resolve(jsonResponse(201, own("00000000-0000-4000-8000-0000000000aa", name)));
    }
    if (url.pathname === "/api/species/candidates") {
      return Promise.resolve(
        jsonResponse(200, candidates[url.searchParams.get("name") ?? ""] ?? NO_CANDIDATES),
      );
    }
    if (url.pathname === "/api/species/own") {
      return Promise.resolve(jsonResponse(200, { items: ownSpecies }));
    }
    if (url.pathname.endsWith("/deletion-preview")) {
      return Promise.resolve(jsonResponse(200, preview));
    }
    if (url.pathname === "/api/species") {
      if (searchStatus === 500) {
        return Promise.resolve(jsonResponse(500, { message: "Internal server error" }));
      }
      const query = (url.searchParams.get("q") ?? "").toLowerCase();
      const items =
        query === "" ? POPULAR : CATALOG.filter((item) => item.name.toLowerCase().includes(query));
      return Promise.resolve(jsonResponse(200, { items }));
    }
    return Promise.resolve(jsonResponse(200, {}));
  }) as typeof fetch;
}

function own(id: string, name: string): SpeciesOptionView {
  return { category: null, id, isOwn: true, key: null, name };
}

function system(
  id: string,
  key: string,
  name: string,
  category: SpeciesOptionView["category"],
): SpeciesOptionView {
  return { category, id, isOwn: false, key, name };
}

const meta = {
  args: {
    inputId: "story-species",
    label: STORY.label,
    onChange: () => undefined,
    placeholder: STORY.placeholder,
    value: null,
  },
  beforeEach: () => {
    mockSpecies({});
  },
  component: SpeciesPicker,
  tags: ["ai-generated"],
  title: "Species/SpeciesPicker",
} satisfies Meta<typeof SpeciesPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PopularGroupedByCategory: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("combobox", { name: STORY.label }));

    await waitFor(() => expect(surface.getByText("Люди та людиноподібні")).toBeVisible());
    await expect(surface.getByText("Ваші види")).toBeInTheDocument();
    await expect(surface.getByRole("option", { name: "Дракон" })).toBeInTheDocument();
  },
  render: () => <Harness />,
};

export const SearchAndSelect: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByRole("combobox", { name: STORY.label });

    await userEvent.click(input);
    await userEvent.type(input, "ельф");

    await userEvent.click(await surface.findByRole("option", { name: "Темний ельф" }));

    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent(
        `${SPECIES.darkElf.id}:Темний ельф`,
      ),
    );
  },
  render: () => <Harness />,
};

export const ExactMatchSelectsExisting: Story = {
  beforeEach: () => {
    mockSpecies({ candidates: { Ельф: { exact: SPECIES.elf, similar: [] } } });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByRole("combobox", { name: STORY.label });

    await userEvent.click(input);
    await userEvent.type(input, "Ельф");

    await waitFor(() => expect(surface.getByText("Такий вид уже є")).toBeVisible());
    await expect(surface.queryByText(/Створити вид/)).toBeNull();

    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.getByTestId("selection")).toHaveTextContent(`${SPECIES.elf.id}:Ельф`),
    );
  },
  render: () => <Harness />,
};

export const SimilarCandidatesStillAllowCreate: Story = {
  beforeEach: () => {
    mockSpecies({
      candidates: { Ельфійка: { exact: null, similar: [SPECIES.elf, SPECIES.halfElf] } },
    });
  },
  parameters: { layout: "fullscreen" },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByRole("combobox", { name: STORY.label });

    await userEvent.click(input);
    await userEvent.type(input, "Ельфійка");

    await waitFor(() => expect(surface.getByText("Схожі види")).toBeVisible());
    await expect(
      surface.getByRole("option", { name: "Усе одно створити «Ельфійка»" }),
    ).toBeInTheDocument();
  },
  render: () => <Harness />,
};

export const CreateSelectsNewSpecies: Story = {
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByRole("combobox", { name: STORY.label });

    await userEvent.click(input);
    await userEvent.type(input, "Фримен");

    await userEvent.click(await surface.findByRole("option", { name: "Створити вид «Фримен»" }));

    await waitFor(() => expect(canvas.getByTestId("selection")).toHaveTextContent(":Фримен"));
  },
  render: () => <Harness />,
};

export const DuplicateConflictOffersExisting: Story = {
  beforeEach: () => {
    mockSpecies({ createStatus: 409 });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);
    const input = canvas.getByRole("combobox", { name: STORY.label });

    await userEvent.click(input);
    await userEvent.type(input, "Шай Хулуд");
    await userEvent.click(await surface.findByRole("option", { name: "Створити вид «Шай Хулуд»" }));

    await waitFor(() =>
      expect(surface.getByText("Такий вид уже існує. Оберіть наявний варіант.")).toBeVisible(),
    );
    await expect(
      surface.getByRole("option", { name: "Обрати наявний: Шаї-Хулуд" }),
    ).toBeInTheDocument();
  },
  render: () => <Harness />,
};

export const LoadError: Story = {
  beforeEach: () => {
    mockSpecies({ searchStatus: 500 });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("combobox", { name: STORY.label }));

    await waitFor(() => expect(surface.getByText("Не вдалося завантажити види.")).toBeVisible(), {
      timeout: STORY.retryTimeoutMs,
    });
    await expect(surface.getByRole("button", { name: "Повторити" })).toBeInTheDocument();
  },
  render: () => <Harness />,
};

export const ClearSelection: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: STORY.label })).toHaveValue("Людина");

    await userEvent.click(canvas.getByRole("button", { name: "Очистити вид" }));

    await waitFor(() => expect(canvas.getByTestId("selection")).toHaveTextContent("none"));
  },
  render: () => <Harness initial={{ id: SPECIES.human.id, label: "Людина" }} />,
};

export const ManageOwnSpecies: Story = {
  beforeEach: () => {
    mockSpecies({
      own: [
        { ...SPECIES.witcher, usage: { bookOverrides: 1, characters: 3, trashed: 1 } },
        { ...SPECIES.sandworm, usage: { bookOverrides: 0, characters: 0, trashed: 0 } },
      ],
      preview: { bookOverrides: 1, canDelete: false, characters: 3, trashed: 1 },
    });
  },
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Керування власними видами" }));

    const dialog = await surface.findByRole("dialog", { name: "Керування власними видами" });
    await waitFor(() => expect(within(dialog).getByText("Відьмак")).toBeVisible());
    await expect(
      within(dialog).getByText("Персонажів: 3 (у кошику: 1) · У книгах: 1"),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Видалити «Відьмак»" }));

    await waitFor(() =>
      expect(
        within(dialog).getByText("Вид «Відьмак» використовується, тому видалити його не можна."),
      ).toBeVisible(),
    );
    await expect(within(dialog).getByRole("button", { name: "Видалити" })).toBeDisabled();
  },
  render: () => <Harness />,
};
