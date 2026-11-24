import { format } from "date-fns";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { ShotsManifest, ShotTheme, ShotViewportName } from "./shots-manifest.ts";
import type { RunOptions } from "./shots-options.ts";
import type { SceneInfo, ShotRecord } from "./shots-records.ts";

type ReportInput = {
  capturedAt: Date;
  manifest: ShotsManifest;
  options: RunOptions;
  outDir: string;
  records: readonly ShotRecord[];
};

type SceneGroup = {
  captured: Extract<ShotRecord, { kind: "captured" }>[];
  scene: SceneInfo;
  skipped: Extract<ShotRecord, { kind: "skipped" }>[];
};

const REPORT = {
  gptPromptFile: "GPT_PROMPT.md",
  indexFile: "index.md",
} as const;

const VIEWPORT_LABELS: Readonly<Record<ShotViewportName, string>> = {
  desktop: "1280 px",
  mobile: "390 px",
};

const THEME_LABELS: Readonly<Record<ShotTheme, string>> = {
  dark: "темна",
  light: "світла",
};

const SOURCE_LABELS: Readonly<Record<SceneInfo["source"], string>> = {
  app: "застосунок, дані тестового акаунта",
  storybook: "Storybook, тестові дані",
};

export async function writeShotsReport(input: ReportInput): Promise<void> {
  const groups = groupByScene(input.records);
  await writeFile(path.join(input.outDir, REPORT.indexFile), renderIndex(input, groups), "utf8");
  await writeFile(
    path.join(input.outDir, REPORT.gptPromptFile),
    renderGptPrompt(input, groups),
    "utf8",
  );
}

function groupByScene(records: readonly ShotRecord[]): SceneGroup[] {
  const groups = new Map<string, SceneGroup>();
  for (const record of records) {
    const key = `${record.scene.source}:${record.scene.id}`;
    const group = groups.get(key) ?? { captured: [], scene: record.scene, skipped: [] };
    if (record.kind === "captured") {
      group.captured.push(record);
    } else {
      group.skipped.push(record);
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.scene.order - right.scene.order);
}

function renderGptPrompt(
  { manifest, options }: ReportInput,
  groups: readonly SceneGroup[],
): string {
  const capturedGroups = groups.filter((group) => group.captured.length > 0);
  const lines = [
    "# Запит для дизайн-рев'ю",
    "",
    "Скопіюйте текст під рискою в ChatGPT і додайте скріншоти з цієї теки. Якщо всі файли не вміщаються в одне повідомлення, надсилайте їх групами за екранами з `index.md`, а цей текст додайте до першого повідомлення.",
    "",
    "---",
    "",
    "Ти досвідчений продуктовий дизайнер інтерфейсів. Зроби рев'ю дизайну екранів веб-застосунку за скріншотами, які я додаю.",
    "",
    "## Продукт",
    "",
    "Book Nest: особистий каталог книжок. Бібліотека, відстеження читання, серії, позики, списки, статистика. Інтерфейс українською та англійською, світла й темна тема, адаптивний від телефона до десктопа.",
    "",
    "## Фіча",
    "",
    `${manifest.title}. ${manifest.summary}`,
    "",
    "## Що на скріншотах",
    "",
    `Назва файлу: \`<номер>-<екран>-<desktop|mobile>-<light|dark>-<мова>.png\`. desktop означає ширину ${VIEWPORT_LABELS.desktop}, mobile означає ${VIEWPORT_LABELS.mobile}. Теми: ${options.themes.map((theme) => THEME_LABELS[theme]).join(", ")}.`,
    "",
    ...capturedGroups.map(
      (group) => `- ${sceneNumber(group.scene)} ${group.scene.title}: ${group.scene.description}`,
    ),
    "",
    "Екрани з позначкою Storybook зроблено з тестовими даними, бо на тестовому акаунті таких станів немає.",
    "",
    "## На що звернути увагу",
    "",
    ...manifest.focus.map((item) => `- ${item}`),
    "- Загальне: візуальна ієрархія, відступи й вирівнювання, типографіка, кольори й контраст (WCAG AA), узгодженість компонентів між екранами, адаптація під телефон, порожні стани, зрозумілість текстів.",
    "",
    "## Обмеження",
    "",
    "- Інтерфейс побудовано на Tailwind CSS і shadcn/ui із семантичними токенами кольорів. Пропонуй зміни в межах цієї системи, а не новий бренд чи новий стиль усього застосунку.",
    "- Оцінюй лише те, що видно на скріншотах. Якщо для висновку чогось бракує, напиши, що саме треба показати.",
    "",
    "## Формат відповіді",
    "",
    "1. Три головні проблеми, з яких варто почати.",
    "2. Таблиця проблем: екран і файл, що не так, чому це заважає користувачу, конкретне виправлення, пріоритет (високий, середній, низький).",
    "3. Що вже зроблено добре і що не варто змінювати.",
    "",
  ];
  return lines.join("\n");
}

function renderIndex(
  { capturedAt, manifest, options }: ReportInput,
  groups: readonly SceneGroup[],
): string {
  const capturedCount = groups.reduce((sum, group) => sum + group.captured.length, 0);
  const lines = [
    `# ${manifest.title}: скріншоти`,
    "",
    `- Знято: ${format(capturedAt, "yyyy-MM-dd HH:mm")}, файлів: ${String(capturedCount)}`,
    `- Застосунок: ${options.baseUrl.origin}`,
    `- Storybook: ${options.storybookUrl.origin}`,
    `- Ширина: ${options.viewports.map((viewport) => `${viewport} ${VIEWPORT_LABELS[viewport]}`).join(", ")}`,
    `- Теми: ${options.themes.map((theme) => THEME_LABELS[theme]).join(", ")}; мови: ${options.locales.join(", ")}`,
    `- Запит для дизайн-рев'ю: [${REPORT.gptPromptFile}](${REPORT.gptPromptFile})`,
  ];
  for (const group of groups) {
    lines.push(
      "",
      `## ${sceneNumber(group.scene)}. ${group.scene.title}`,
      "",
      group.scene.description,
      "",
    );
    lines.push(`Джерело: ${SOURCE_LABELS[group.scene.source]}.`);
    const firstUrl = group.captured[0]?.url;
    if (firstUrl !== undefined) lines.push(`Адреса: \`${firstUrl}\``);
    if (group.captured.length > 0) {
      lines.push(
        "",
        "| Файл | Ширина | Тема | Мова | Зауваги |",
        "| --- | --- | --- | --- | --- |",
      );
      for (const record of group.captured) {
        lines.push(
          `| [${record.file}](${record.file}) | ${VIEWPORT_LABELS[record.viewport]} | ${THEME_LABELS[record.theme]} | ${record.locale} | ${record.warnings.join("; ")} |`,
        );
      }
    }
    for (const [reason, viewports] of skippedReasons(group)) {
      lines.push("", `Не знято (${viewports.join(", ")}): ${reason}.`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function sceneNumber(scene: SceneInfo): string {
  return String(scene.order).padStart(2, "0");
}

function skippedReasons(group: SceneGroup): Map<string, ShotViewportName[]> {
  const reasons = new Map<string, ShotViewportName[]>();
  for (const record of group.skipped) {
    const viewports = reasons.get(record.reason) ?? [];
    if (!viewports.includes(record.viewport)) viewports.push(record.viewport);
    reasons.set(record.reason, viewports);
  }
  return reasons;
}
