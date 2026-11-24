import { z } from "zod";

import type { ShotsManifest, ShotTargets, TargetDiscovery } from "../shots-manifest.ts";

const GOAL_STATUSES = ["active", "completed", "expired", "archived"] as const;

const GoalListSchema = z.object({
  items: z.array(z.object({ id: z.string(), status: z.enum(GOAL_STATUSES) })),
});

const GOALS_API_PATH = "/api/goals";

async function discoverGoalsByStatus({ open, page }: TargetDiscovery): Promise<ShotTargets> {
  const targets: Record<string, string> = {};
  for (const status of GOAL_STATUSES) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.request().method() === "GET" &&
          new URL(candidate.url()).pathname === GOALS_API_PATH &&
          new URL(candidate.url()).searchParams.get("status") === status,
      ),
      open(`/goals?status=${status}`),
    ]);
    if (!response.ok()) {
      throw new Error(`${GOALS_API_PATH}?status=${status} answered ${String(response.status())}`);
    }
    const list = GoalListSchema.parse(await response.json());
    const goal = list.items.find((item) => item.status === status);
    if (goal !== undefined) {
      targets[status] = goal.id;
    }
  }
  return targets;
}

export const readingGoalsManifest: ShotsManifest = {
  appScenes: [
    {
      description:
        "Каталог усіх цілей: KPI-огляд, блок «Потребують уваги», картки цілей з прогресом і бейджами темпу та ризику.",
      id: "catalog",
      path: "/goals",
      title: "Каталог цілей",
    },
    {
      description:
        "Сторінка активної цілі, вкладка «Огляд»: шапка, герой прогресу з маркером плану, темп і прогноз, стан цілі з ризиками, контрольні точки, останні події.",
      id: "active-overview",
      path: "/goals/{active}",
      title: "Активна ціль, Огляд",
    },
    {
      description:
        "Вкладка «Книги» з фільтром «Усі»: лічильники на фільтрах, зараховані й ще не зараховані книги, прогрес сторінок для книг у процесі.",
      id: "active-books-all",
      steps: [{ kind: "click", name: { en: "Books", uk: "Книги" }, role: "tab" }],
      title: "Активна ціль, Книги: усі",
    },
    {
      description: "Вкладка «Книги», фільтр «Зараховані».",
      id: "active-books-counted",
      steps: [{ kind: "click", name: { en: /^Counted/, uk: /^Зараховані/ }, role: "radio" }],
      title: "Активна ціль, Книги: зараховані",
    },
    {
      description: "Вкладка «Книги», фільтр «Ще не зараховані».",
      id: "active-books-remaining",
      steps: [
        { kind: "click", name: { en: /^Not counted yet/, uk: /^Ще не зараховані/ }, role: "radio" },
      ],
      title: "Активна ціль, Книги: ще не зараховані",
    },
    {
      description: "Вкладка «Історія»: події цілі, згруповані за днями.",
      id: "active-activity",
      steps: [{ kind: "click", name: { en: "Activity", uk: "Історія" }, role: "tab" }],
      title: "Активна ціль, Історія",
    },
    {
      capture: "viewport",
      cleanup: [{ key: "Escape", kind: "press" }],
      description: "Діалог редагування цілі поверх сторінки цілі.",
      id: "active-edit-dialog",
      path: "/goals/{active}",
      steps: [
        { kind: "click", name: { en: "Edit the goal", uk: "Редагувати ціль" }, role: "button" },
        { kind: "waitFor", role: "dialog" },
      ],
      title: "Діалог редагування цілі",
    },
    {
      capture: "viewport",
      cleanup: [{ key: "Escape", kind: "press" }],
      description: "Меню «Інші дії з ціллю» на телефоні: архівування і видалення.",
      id: "active-more-actions",
      path: "/goals/{active}",
      steps: [
        {
          kind: "click",
          name: { en: "More goal actions", uk: "Інші дії з ціллю" },
          role: "button",
        },
        { kind: "waitFor", role: "menu" },
      ],
      title: "Меню дій з ціллю (телефон)",
      viewports: ["mobile"],
    },
    {
      description:
        "Ціль, у якої минув дедлайн: стан «прострочена» та ілюстрація з пісочним годинником.",
      id: "expired-overview",
      path: "/goals/{expired}",
      title: "Прострочена ціль, Огляд",
    },
    {
      description: "Виконана ціль: стан «виконано» та ілюстрація.",
      id: "completed-overview",
      path: "/goals/{completed}",
      title: "Виконана ціль, Огляд",
    },
    {
      description: "Архівна ціль: як сторінка виглядає після архівування.",
      id: "archived-overview",
      path: "/goals/{archived}",
      title: "Архівна ціль, Огляд",
    },
  ],
  discoverTargets: discoverGoalsByStatus,
  feature: "reading-goals",
  focus: [
    "Чи зрозуміло з першого погляду, чи встигає користувач до дедлайну: герой прогресу, маркер плану, темп і прогноз.",
    "Чи не суперечать одне одному бейджі темпу й ризику, тексти стану цілі та прогноз.",
    "Ієрархія карток на вкладці «Огляд» і їхня щільність на телефоні.",
    "Порожні стани та ілюстрації: чи виглядають вони частиною одного стилю.",
    "Вкладки й фільтри на телефоні: розміри зон натискання, переноси, горизонтальне прокручування.",
  ],
  stories: [
    {
      description:
        "Каталог без жодної цілі: ілюстрація порожнього каталогу і заклик створити ціль.",
      id: "story-empty-catalog",
      storyId: "reading-goals-screens--empty-catalog",
      title: "Порожній каталог (Storybook)",
    },
    {
      description: "Виконана ціль з тестовими даними: стан «виконано» та ілюстрація.",
      id: "story-completed-goal",
      storyId: "reading-goals-screens--completed-goal",
      title: "Виконана ціль (Storybook)",
    },
    {
      description: "Архівна ціль з тестовими даними.",
      id: "story-archived-goal",
      storyId: "reading-goals-screens--archived-goal",
      title: "Архівна ціль (Storybook)",
    },
    {
      description:
        "Активна ціль із замалою кількістю даних для прогнозу: ілюстрація «замало даних» у картці темпу й прогнозу.",
      id: "story-low-confidence-forecast",
      storyId: "reading-goals-screens--low-confidence-forecast",
      title: "Прогноз з низькою впевненістю (Storybook)",
    },
  ],
  summary:
    "Користувач обирає список книг і ставить ціль прочитати з нього N книг до дедлайну. Книга зараховується, коли її дочитано в межах періоду цілі. Застосунок показує прогрес, темп відносно плану, прогноз завершення, ризик не встигнути, контрольні точки та історію подій.",
  title: "Цілі читання",
};
