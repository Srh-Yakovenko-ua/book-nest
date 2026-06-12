import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { GenreIcon, type GenreIconName } from "./genre-icon";

const ALL_GENRE_ICONS: readonly GenreIconName[] = [
  "fentezi",
  "temne-fentezi",
  "miske-fentezi",
  "epichne-fentezi",
  "cozy-fantasy",
  "naukova-fantastyka",
  "antyutopiia",
  "postapokalipsys",
  "kiberpank",
  "stympank",
  "roman",
  "suchasna-proza",
  "klasychna-literatura",
  "istorychnyy-roman",
  "simeyna-saha",
  "sotsialna-proza",
  "psykholohichna-proza",
  "romantyka",
  "suchasna-romantyka",
  "istorychna-romantyka",
  "fentezi-romantyka",
  "paranormalna-romantyka",
  "romantychna-komediia",
  "detektyv",
  "klasychnyy-detektyv",
  "psykholohichnyy-detektyv",
  "politseyskyy-detektyv",
  "kryminalnyy-roman",
  "tryler",
  "psykholohichnyy-tryler",
  "mistychnyy-tryler",
  "shpyhunskyy-tryler",
  "horor",
  "mistyka",
  "hotychnyy-roman",
  "paranormalne",
  "saspens",
  "young-adult",
  "new-adult",
  "pidlitkova-literatura",
  "dytiacha-literatura",
  "kazky",
  "pryhody",
  "komiksy",
  "manga",
  "hrafichnyy-roman",
  "non-fikshn",
  "biohrafiia",
  "avtobiohrafiia",
  "memuary",
  "eseistyka",
  "publitsystyka",
  "reportazhystyka",
  "istoriia",
  "populiarna-nauka",
  "psykholohiia",
  "samorozvytok",
  "biznes",
  "menedzhment",
  "marketynh",
  "finansy",
  "ekonomika",
  "polityka",
  "filosofiia",
  "sotsiolohiia",
  "kultura",
  "mystetstvo",
  "relihiia",
  "dukhovnist",
  "poeziia",
  "drama",
  "piesa",
  "humor",
  "satyra",
  "navchalna-literatura",
  "profesiyna-literatura",
  "it",
  "prohramuvannia",
  "medytsyna",
  "pravo",
  "osvita",
  "movy",
  "pidruchnyk",
  "kulinariia",
  "podorozhi",
  "sport",
  "zdorovia",
  "khobi",
  "inshe",
];

const meta = {
  args: {
    name: "fentezi",
    size: 24,
  },
  argTypes: {
    name: {
      control: "select",
      options: ALL_GENRE_ICONS,
    },
    size: { control: { type: "number" } },
  },
  component: GenreIcon,
  tags: ["ai-generated"],
  title: "Icons/GenreIcon",
} satisfies Meta<typeof GenreIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const Titled: Story = {
  args: { name: "detektyv", title: "Детектив" },
  play: async ({ canvas }) => {
    const icon = canvas.getByRole("img", { name: "Детектив" });
    const use = icon.querySelector("use");
    await expect(use).toHaveAttribute("href", "/icons/genre-icons.svg#genre-detektyv");
  },
};

export const All: Story = {
  play: async ({ canvasElement }) => {
    const uses = canvasElement.querySelectorAll<SVGUseElement>("use");
    await expect(uses.length).toBe(ALL_GENRE_ICONS.length);

    await waitFor(() => {
      const unresolved = [...uses].filter((use) => {
        const bb = use.getBBox();
        return bb.width <= 0 && bb.height <= 0;
      });
      expect(unresolved).toHaveLength(0);
    });

    const failing = [...uses]
      .filter((use) => {
        const bb = use.getBBox();
        return !(bb.width > 0 && bb.height > 0);
      })
      .map((use) => use.getAttribute("href") ?? "(missing href)");
    await expect(failing).toEqual([]);
  },
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 text-foreground">
      {ALL_GENRE_ICONS.map((name) => (
        <div
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3"
          key={name}
        >
          <GenreIcon name={name} size={26} />
          <span className="truncate text-[10px] text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  ),
};
