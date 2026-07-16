# Завдання для фронтенду: розширений пріоритет книги в черзі читання

## Контекст

У формі створення або редагування книги вже є блок **«Організація бібліотеки»** з можливістю:

- додати книгу до улюблених;
- додати книгу до черги читання;
- обрати пріоритет:
  - низький;
  - звичайний;
  - високий;
- додати книгу до власних списків.

Зараз на бекенд передається лише:

```json
{
  "queuePriority": "high"
}
```

Після оновлення бекенду також будуть доступні поля:

```ts
type QueuePriority = "low" | "normal" | "high";

type QueuePriorityReason =
  | "book_club"
  | "buddy_read"
  | "event_or_deadline"
  | "return_due"
  | "series_order"
  | "reading_goal"
  | "anticipated_release"
  | "other";
```

```ts
queuePriority: QueuePriority;
queuePriorityReason: QueuePriorityReason | null;
queuePriorityReasonCustomText: string | null;
queuePriorityTargetDate: string | null; // YYYY-MM-DD
```

Потрібно реалізувати повний фронтенд-функціонал вибору пріоритету, причини та дати події або дедлайну.

---

# 1. Загальна логіка блоку

Блок налаштування пріоритету показується лише тоді, коли активний перемикач:

```text
Додати до черги читання
```

Якщо книга не додається до черги, весь блок пріоритету, причини та дати потрібно приховати.

Після увімкнення перемикача показати:

1. заголовок блоку;
2. три варіанти пріоритету;
3. інформацію лише про активний пріоритет;
4. додаткові поля для високого пріоритету;
5. текстову примітку про позицію книги в черзі.

---

# 2. Заголовок блоку

```text
Пріоритет читання
```

Підзаголовок:

```text
Обери пріоритет для цієї книги в черзі читання.
```

Для заголовка використати іконку з `lucide-react`:

```ts
Bookmark
```

Праворуч від заголовка можна показати інформаційну іконку:

```ts
Info
```

Tooltip для `Info`:

```text
Пріоритет показує важливість книги, але не змінює її позицію в черзі автоматично.
```

---

# 3. Варіанти пріоритету

Показати три інтерактивні картки або сегменти:

```ts
"low"
"normal"
"high"
```

Рекомендований порядок:

1. Низький
2. Звичайний
3. Високий

## Низький

Заголовок:

```text
Низький
```

Короткий опис:

```text
Можна залишити на пізніше
```

Іконка:

```ts
ChevronsDown
```

## Звичайний

Заголовок:

```text
Звичайний
```

Короткий опис:

```text
Читати у встановленому порядку
```

Іконка:

```ts
Minus
```

## Високий

Заголовок:

```text
Високий
```

Короткий опис:

```text
Прочитати найближчим часом
```

Іконка:

```ts
ChevronsUp
```

---

# 4. Вибір активного пріоритету

Одночасно може бути активним лише один пріоритет.

За замовчуванням:

```ts
queuePriority = "normal"
```

Активний пріоритет має відрізнятися:

- кольором рамки;
- кольором іконки;
- м’яким фоном;
- радіокнопкою або іконкою вибору;
- `aria-checked="true"`.

Рекомендована іконка активного стану:

```ts
CircleCheck
```

Неактивний стан:

```ts
Circle
```

Уся картка пріоритету має бути клікабельною, а не лише радіокнопка.

Потрібно підтримати:

- клік мишею;
- навігацію клавіатурою;
- `Enter`;
- `Space`;
- видимий `focus-visible`;
- коректну семантику `radiogroup`.

---

# 5. Інформація про активний пріоритет

Під картками пріоритетів показувати тільки один інформаційний блок — для активного значення.

Не потрібно одночасно показувати описи всіх трьох пріоритетів.

## Для високого пріоритету

Заголовок:

```text
Високий пріоритет
```

Короткий текст:

```text
Для книг, які важливо прочитати найближчим часом.
```

Розгорнутий текст:

```text
Обери високий пріоритет, якщо книгу потрібно прочитати до певної події,
обговорення чи дедлайну, повернути власнику або завершити перед наступною
частиною серії.
```

Іконка:

```ts
ChevronsUp
```

## Для звичайного пріоритету

Заголовок:

```text
Звичайний пріоритет
```

Короткий текст:

```text
Для книг, які плануєш читати у встановленому порядку.
```

Розгорнутий текст:

```text
Стандартний варіант для більшості книг у черзі. Обери його, якщо книга
важлива, але не має конкретного дедлайну чи причини читати її негайно.
```

Іконка:

```ts
Minus
```

## Для низького пріоритету

Заголовок:

```text
Низький пріоритет
```

Короткий текст:

```text
Для книг, які можна залишити на пізніше.
```

Розгорнутий текст:

```text
Обери низький пріоритет, якщо книга цікава, але поки не входить до
найближчих читацьких планів і може поступитися місцем важливішим книгам.
```

Іконка:

```ts
ChevronsDown
```

---

# 6. Додаткові поля для високого пріоритету

Поля причини та дати показувати лише для:

```ts
queuePriority === "high"
```

Для `normal` і `low` ці поля потрібно приховувати.

При зміні пріоритету з `high` на `normal` або `low` потрібно очистити локальні значення:

```ts
queuePriorityReason = null;
queuePriorityReasonCustomText = "";
queuePriorityTargetDate = null;
```

Не залишати приховані значення у формі та не відправляти їх на бекенд.

---

# 7. Поле причини високого пріоритету

Label:

```text
Чому ця книга має високий пріоритет?
```

Позначка:

```text
Необов’язково
```

Placeholder:

```text
Обери причину
```

Використати `Select`, `Combobox` або інший стандартний компонент проєкту.

## Варіанти

| Значення API | Текст | Lucide-іконка |
|---|---|---|
| `book_club` | Книжковий клуб | `Users` |
| `buddy_read` | Спільне читання | `UserRoundCheck` |
| `event_or_deadline` | Подія або дедлайн | `CalendarClock` |
| `return_due` | Треба повернути | `Undo2` |
| `series_order` | Порядок серії | `LibraryBig` |
| `reading_goal` | Читацька ціль | `Target` |
| `anticipated_release` | Довгоочікувана новинка | `Sparkles` |
| `other` | Інше | `Ellipsis` |

Значення причини не є обов’язковим.

Варіант `other` не повинен зберігати довільний текст у самому enum.

---

# 8. Поле «Інше»

Коли користувач обирає:

```ts
queuePriorityReason === "other"
```

показати додатковий текстовий інпут.

Label:

```text
Вкажи причину
```

Placeholder:

```text
Наприклад, хочу прочитати перед відпусткою
```

Іконка:

```ts
MessageSquareText
```

Поле:

```ts
queuePriorityReasonCustomText
```

## Валідація

Для `other` текст стає обов’язковим.

Правила:

- застосувати `trim()`;
- не дозволяти порожній текст;
- максимальна довжина — 300 символів;
- показувати лічильник символів за потреби;
- не відправляти пробіли на початку та в кінці.

При зміні причини з `other` на іншу очистити:

```ts
queuePriorityReasonCustomText = "";
```

Повідомлення про помилку:

```text
Вкажи власну причину високого пріоритету.
```

---

# 9. Поле дати події або дедлайну

Поле дати показувати тільки для таких причин:

```ts
const REASONS_WITH_DATE: QueuePriorityReason[] = [
  "book_club",
  "buddy_read",
  "event_or_deadline",
  "return_due",
];
```

Label:

```text
Дата події або дедлайну
```

Позначка:

```text
Необов’язково
```

Placeholder:

```text
Обери дату
```

Іконка:

```ts
CalendarDays
```

Поле:

```ts
queuePriorityTargetDate
```

На бекенд дата передається у форматі:

```text
YYYY-MM-DD
```

У UI дата може показуватися у локалізованому форматі, наприклад:

```text
24 серпня 2026
```

Час обирати не потрібно.

Не конвертувати значення через UTC таким чином, щоб дата могла зміститися на попередній або наступний день.

При зміні причини на варіант без підтримки дати очистити:

```ts
queuePriorityTargetDate = null;
```

Для `other` поле дати у поточній версії не показувати.

---

# 10. Пояснення під полем дати

Під полем дати можна показати допоміжний текст:

```text
Дата допоможе не пропустити подію, дедлайн або термін повернення.
```

Для `return_due` можна використовувати контекстний текст:

```text
Вкажи дату, до якої книгу потрібно повернути.
```

Це необов’язкове покращення. Базова версія може використовувати один універсальний текст.

---

# 11. Примітка про позицію в черзі

Під усім блоком пріоритету показати примітку:

```text
Пріоритет не змінює позицію книги автоматично. Після додавання книга
з’явиться в кінці черги. Змінити порядок читання можна на сторінці
Черга читання.
```

Текст:

```text
Черга читання
```

має бути клікабельним посиланням на відповідну сторінку.

Використати актуальний route проєкту. Не створювати новий маршрут, якщо він уже існує.

Іконка примітки:

```ts
Info
```

Стилістично це має бути не alert із помилкою, а спокійний інформаційний текст, як примітка під блоком «Статус володіння».

Посилання має використовувати `primary` або `brand` колір і мати hover/focus-стан.

---

# 12. Структура стану форми

Рекомендована структура:

```ts
type QueuePriorityFormValues = {
  addToQueue: boolean;
  queuePriority: QueuePriority;
  queuePriorityReason: QueuePriorityReason | null;
  queuePriorityReasonCustomText: string;
  queuePriorityTargetDate: string | null;
};
```

Початкові значення для нової книги:

```ts
const defaultValues: QueuePriorityFormValues = {
  addToQueue: false,
  queuePriority: "normal",
  queuePriorityReason: null,
  queuePriorityReasonCustomText: "",
  queuePriorityTargetDate: null,
};
```

Якщо використовується `React Hook Form`, залежності можна відстежувати через:

```ts
useWatch
```

або `watch`.

Не дублювати ті самі значення у локальному `useState`, якщо вони вже керуються формою.

---

# 13. Логіка очищення полів

Рекомендовано винести в окрему функцію:

```ts
function normalizeQueuePriorityFields(
  values: QueuePriorityFormValues,
): QueuePriorityFormValues
```

Правила нормалізації:

```ts
if (!values.addToQueue) {
  return {
    ...values,
    queuePriority: "normal",
    queuePriorityReason: null,
    queuePriorityReasonCustomText: "",
    queuePriorityTargetDate: null,
  };
}
```

```ts
if (values.queuePriority !== "high") {
  return {
    ...values,
    queuePriorityReason: null,
    queuePriorityReasonCustomText: "",
    queuePriorityTargetDate: null,
  };
}
```

```ts
if (values.queuePriorityReason !== "other") {
  values.queuePriorityReasonCustomText = "";
}
```

```ts
if (
  !values.queuePriorityReason ||
  !REASONS_WITH_DATE.includes(values.queuePriorityReason)
) {
  values.queuePriorityTargetDate = null;
}
```

Ця логіка має працювати:

- у UI під час перемикання;
- перед submit;
- під час формування API payload.

---

# 14. Формування payload

## Книга не додається до черги

Якщо API не очікує queue-поля для книги поза чергою, не передавати їх або передати значення згідно з поточним контрактом проєкту.

Не вигадувати нову серверну логіку.

## Звичайний пріоритет

```json
{
  "queuePriority": "normal",
  "queuePriorityReason": null,
  "queuePriorityReasonCustomText": null,
  "queuePriorityTargetDate": null
}
```

## Низький пріоритет

```json
{
  "queuePriority": "low",
  "queuePriorityReason": null,
  "queuePriorityReasonCustomText": null,
  "queuePriorityTargetDate": null
}
```

## Високий без причини

```json
{
  "queuePriority": "high",
  "queuePriorityReason": null,
  "queuePriorityReasonCustomText": null,
  "queuePriorityTargetDate": null
}
```

## Високий із причиною та датою

```json
{
  "queuePriority": "high",
  "queuePriorityReason": "book_club",
  "queuePriorityReasonCustomText": null,
  "queuePriorityTargetDate": "2026-08-24"
}
```

## Високий із причиною «Інше»

```json
{
  "queuePriority": "high",
  "queuePriorityReason": "other",
  "queuePriorityReasonCustomText": "Хочу прочитати перед відпусткою",
  "queuePriorityTargetDate": null
}
```

Порожній рядок не відправляти. Замість нього передавати:

```ts
null
```

---

# 15. Редагування наявної книги

Під час відкриття форми редагування потрібно заповнити поля значеннями з API:

```ts
queuePriority
queuePriorityReason
queuePriorityReasonCustomText
queuePriorityTargetDate
```

Якщо бекенд повернув старий запис без нових даних:

```ts
queuePriorityReason = null;
queuePriorityReasonCustomText = "";
queuePriorityTargetDate = null;
```

Потрібно коректно показати:

- активний пріоритет;
- обрану причину;
- інпут «Інше», якщо він потрібен;
- поле дати, якщо причина підтримує дату.

Не очищати значення під час першої ініціалізації форми.

Очищення залежних значень виконується лише після реальної зміни користувачем або перед submit згідно з правилами нормалізації.

---

# 16. Валідація на фронтенді

Фронтенд повинен повторювати основні правила бекенду.

## Валідні сценарії

- `high` без причини;
- `high` із причиною;
- `high` із причиною та датою;
- `normal` без додаткових даних;
- `low` без додаткових даних;
- `other` із заповненим текстом.

## Невалідні сценарії

- `other` без тексту;
- `other` із текстом лише з пробілів;
- текст довший за 300 символів;
- дата для причини, яка не підтримує дату;
- приховані додаткові значення для `normal` або `low`.

Серверні помилки потрібно мапити до конкретних полів форми.

---

# 17. Структура компонентів

Не створювати один великий компонент із усією логікою.

Рекомендована структура:

```text
queue-priority/
├── QueuePrioritySection.tsx
├── QueuePriorityOptions.tsx
├── QueuePriorityOptionCard.tsx
├── QueuePriorityDetails.tsx
├── QueuePriorityReasonSelect.tsx
├── QueuePriorityCustomReasonField.tsx
├── QueuePriorityTargetDateField.tsx
├── QueuePriorityPositionNote.tsx
├── queue-priority.constants.ts
├── queue-priority.types.ts
├── queue-priority.utils.ts
└── queue-priority.validation.ts
```

Назви можна адаптувати до поточної структури проєкту.

## Відповідальність компонентів

### `QueuePrioritySection`

- об’єднує весь блок;
- отримує form control;
- показує секцію лише при активному `addToQueue`;
- координує залежні поля.

### `QueuePriorityOptions`

- рендерить три варіанти;
- має семантику `radiogroup`;
- не містить API-логіки.

### `QueuePriorityOptionCard`

- універсальна картка одного пріоритету;
- приймає:
  - label;
  - description;
  - icon;
  - active;
  - onSelect;
  - tone.

### `QueuePriorityDetails`

- показує опис лише активного пріоритету;
- для `high` також показує додаткові поля.

### `QueuePriorityReasonSelect`

- містить список enum-значень;
- використовує Lucide-іконки;
- не зберігає довільний текст.

### `QueuePriorityCustomReasonField`

- показується лише для `other`;
- відповідає за текст і валідацію.

### `QueuePriorityTargetDateField`

- показується лише для причин із датою;
- відповідає за формат `YYYY-MM-DD`.

### `QueuePriorityPositionNote`

- показує інформаційну примітку;
- містить посилання на сторінку черги.

---

# 18. Константи

Усі тексти, іконки та правила краще описати конфігурацією:

```ts
import {
  ChevronsDown,
  ChevronsUp,
  Minus,
  type LucideIcon,
} from "lucide-react";

type PriorityConfig = {
  value: QueuePriority;
  label: string;
  shortDescription: string;
  title: string;
  description: string;
  extendedDescription: string;
  icon: LucideIcon;
  tone: "low" | "normal" | "high";
};
```

```ts
export const QUEUE_PRIORITY_CONFIG: Record<
  QueuePriority,
  PriorityConfig
> = {
  low: {
    value: "low",
    label: "Низький",
    shortDescription: "Можна залишити на пізніше",
    title: "Низький пріоритет",
    description: "Для книг, які можна залишити на пізніше.",
    extendedDescription:
      "Обери низький пріоритет, якщо книга цікава, але поки не входить до найближчих читацьких планів і може поступитися місцем важливішим книгам.",
    icon: ChevronsDown,
    tone: "low",
  },
  normal: {
    value: "normal",
    label: "Звичайний",
    shortDescription: "Читати у встановленому порядку",
    title: "Звичайний пріоритет",
    description:
      "Для книг, які плануєш читати у встановленому порядку.",
    extendedDescription:
      "Стандартний варіант для більшості книг у черзі. Обери його, якщо книга важлива, але не має конкретного дедлайну чи причини читати її негайно.",
    icon: Minus,
    tone: "normal",
  },
  high: {
    value: "high",
    label: "Високий",
    shortDescription: "Прочитати найближчим часом",
    title: "Високий пріоритет",
    description:
      "Для книг, які важливо прочитати найближчим часом.",
    extendedDescription:
      "Обери високий пріоритет, якщо книгу потрібно прочитати до певної події, обговорення чи дедлайну, повернути власнику або завершити перед наступною частиною серії.",
    icon: ChevronsUp,
    tone: "high",
  },
};
```

Не дублювати ці тексти у кількох компонентах.

---

# 19. Структура стилів

Проєкт використовує Tailwind CSS, shadcn-компоненти та CSS variables.

Не використовувати випадкові hardcoded-кольори без потреби.

Потрібно використовувати наявні токени теми:

```css
--background
--foreground
--ink
--card
--muted
--muted-foreground
--border
--field
--primary
--primary-hover
--accent
--accent-border
--success
--success-soft
--warning
--warning-soft
--info
--info-soft
--ring
```

Також використовувати наявні радіуси й тіні:

```css
--radius
--elevation-soft
--elevation-card
--elevation-hover
```

## Основний контейнер

Рекомендовані класи:

```tsx
className="
  rounded-xl
  border
  border-border
  bg-card
  p-4
  shadow-card
  sm:p-5
"
```

Якщо блок уже знаходиться всередині великої картки форми, не створювати зайву вкладену білу картку без потреби.

## Картки пріоритетів

Базовий стиль:

```tsx
className="
  relative
  flex
  min-h-24
  cursor-pointer
  items-center
  gap-3
  rounded-xl
  border
  border-border
  bg-card
  p-4
  text-left
  transition
  hover:border-accent-border
  hover:shadow-soft
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-ring
  focus-visible:ring-offset-2
"
```

Активний стан не повинен будуватися через inline-style.

Використати tone-класи або `cva`.

---

# 20. Кольори пріоритетів

## Високий

Використати брендово-теракотовий акцент:

```text
text-primary
border-primary
bg-primary/5
```

Іконка:

```text
bg-primary/15
text-primary
```

## Звичайний

Використати теплий золотистий акцент:

```text
text-warning
border-warning/60
bg-warning-soft/60
```

Іконка:

```text
bg-warning-soft
text-warning
```

## Низький

Використати спокійний зелений акцент:

```text
text-success
border-success/50
bg-success-soft/60
```

Іконка:

```text
bg-success-soft
text-success
```

Не використовувати дуже насичені суцільні фони на всю картку.

Колір має бути акцентом, а не конкурувати з основними CTA-кнопками.

---

# 21. `cva` для картки пріоритету

Рекомендована структура:

```ts
const priorityCardVariants = cva(
  [
    "relative flex min-h-24 cursor-pointer items-center gap-3 rounded-xl",
    "border bg-card p-4 text-left transition",
    "hover:shadow-soft focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ],
  {
    variants: {
      tone: {
        low: "",
        normal: "",
        high: "",
      },
      active: {
        true: "",
        false: "border-border hover:border-accent-border",
      },
    },
    compoundVariants: [
      {
        tone: "low",
        active: true,
        className: "border-success/60 bg-success-soft/40",
      },
      {
        tone: "normal",
        active: true,
        className: "border-warning/60 bg-warning-soft/40",
      },
      {
        tone: "high",
        active: true,
        className: "border-primary bg-primary/5",
      },
    ],
    defaultVariants: {
      active: false,
    },
  },
);
```

Не обов’язково копіювати цей код буквально, але потрібно зберегти структуру через variant-класи, а не розкидати умовні рядки по JSX.

---

# 22. Стиль інформаційного блоку

Інформаційний блок активного пріоритету:

```tsx
className="
  rounded-xl
  border
  border-border
  bg-secondary/30
  p-4
  sm:p-5
"
```

Всередині:

```text
іконка + заголовок + короткий опис + розгорнутий опис
```

Для `high` додаткові поля можна відокремити:

```tsx
className="
  mt-5
  grid
  gap-4
  border-t
  border-border
  pt-5
  lg:grid-cols-2
"
```

На мобільному поля мають іти в одну колонку.

---

# 23. Стиль іконок

Усі іконки брати тільки з:

```ts
lucide-react
```

Не додавати:

- emoji;
- сторонні SVG;
- Material Icons;
- Heroicons;
- Font Awesome;
- текстові символи замість іконок.

Рекомендовані розміри:

```text
16 px — допоміжні іконки в полях та списках
18 px — перемикачі й невеликі кнопки
20 px — іконки карток пріоритету
22–24 px — основна іконка інформаційного блоку
```

Використовувати:

```tsx
strokeWidth={1.8}
```

або спільне значення, яке вже прийняте в проєкті.

Не задавати кожній іконці випадкову товщину лінії.

Іконки повинні мати:

```tsx
aria-hidden="true"
```

якщо вони декоративні й поруч уже є текст.

---

# 24. Стиль полів

Використовувати наявні `Input`, `Select`, `Popover`, `Calendar`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`.

Не створювати власні поля з нуля, якщо потрібний компонент уже є у UI-kit.

Стани:

- default;
- hover;
- focus;
- error;
- disabled.

Вони мають використовувати глобальні стилі:

```css
--field
--input
--border
--ring
--destructive
```

Label має бути над полем.

Позначку `Необов’язково` показати менш контрастним текстом:

```text
text-muted-foreground
```

---

# 25. Анімація умовних полів

Поля причини, власного тексту та дати можуть з’являтися з легкою анімацією.

Використовувати вже підключені утиліти `tw-animate-css`, наприклад:

```text
animate-in fade-in-0 slide-in-from-top-1 duration-150
```

Не використовувати довгі або надто помітні анімації.

Обов’язково враховувати:

```css
prefers-reduced-motion
```

У проєкті вже є глобальне вимкнення складних анімацій для цього режиму.

---

# 26. Адаптивність

## Desktop

Три картки пріоритету в один ряд:

```text
grid-cols-3
```

Причина та дата:

```text
grid-cols-2
```

## Tablet

Картки можуть залишатися в три колонки, якщо ширини достатньо.

Якщо текст стискається, перейти на:

```text
grid-cols-1 або grid-cols-2
```

Не зменшувати шрифт до нечитабельного розміру.

## Mobile

- одна картка пріоритету на рядок;
- причина та дата в одну колонку;
- кнопки форми можуть займати всю ширину;
- посилання у примітці не повинно виходити за контейнер;
- dropdown не повинен виходити за межі viewport.

---

# 27. Локалізація

Не залишати текстові значення безпосередньо у JSX, якщо проєкт уже використовує i18n.

Додати ключі для української та англійської локалей.

Рекомендована структура:

```text
queuePriority.title
queuePriority.subtitle
queuePriority.low.label
queuePriority.low.shortDescription
queuePriority.low.title
queuePriority.low.description
queuePriority.low.extendedDescription
queuePriority.normal.*
queuePriority.high.*
queuePriority.reason.label
queuePriority.reason.placeholder
queuePriority.reason.bookClub
queuePriority.reason.buddyRead
queuePriority.reason.eventOrDeadline
queuePriority.reason.returnDue
queuePriority.reason.seriesOrder
queuePriority.reason.readingGoal
queuePriority.reason.anticipatedRelease
queuePriority.reason.other
queuePriority.customReason.label
queuePriority.customReason.placeholder
queuePriority.targetDate.label
queuePriority.targetDate.placeholder
queuePriority.positionNote
queuePriority.positionNoteLink
```

Не змінювати існуючу систему локалізації.

---

# 28. Accessibility

Потрібно забезпечити:

- `radiogroup` для вибору пріоритету;
- `radio` або семантичний аналог для кожної картки;
- зв’язок `label` і поля;
- `aria-invalid` для невалідних полів;
- `aria-describedby` для helper/error-текстів;
- keyboard navigation;
- видимий focus;
- достатній контраст;
- tooltip, доступний з клавіатури;
- зрозумілий текст посилання.

Не використовувати тільки колір для позначення активного пріоритету.

Активний стан також має містити іконку вибору та доступний стан `checked`.

---

# 29. Обробка API-помилок

Якщо бекенд повертає помилку для:

```text
queuePriorityReason
queuePriorityReasonCustomText
queuePriorityTargetDate
```

показати повідомлення біля відповідного поля.

Якщо поле з помилкою наразі приховане через неконсистентний стан, потрібно:

1. відновити потрібний пріоритет або причину, якщо це можливо;
2. показати загальне повідомлення форми;
3. не втрачати введені користувачем дані без пояснення.

---

# 30. Необхідні тести

Додати тести для UI та form logic.

## Відображення

1. Блок прихований, якщо книга не додається до черги.
2. Після увімкнення черги активний `normal`.
3. Відображається опис лише активного пріоритету.
4. Для `normal` додаткових полів немає.
5. Для `low` додаткових полів немає.
6. Для `high` показується поле причини.
7. Дата показується лише для підтримуваних причин.
8. Для `other` показується текстовий інпут.
9. Для `other` дата не показується.
10. Примітка про позицію показується під блоком.

## Поведінка

11. Перемикання `high -> normal` очищає причину, текст і дату.
12. Перемикання `high -> low` очищає причину, текст і дату.
13. Зміна `other` на іншу причину очищає custom text.
14. Зміна причини з датою на причину без дати очищає дату.
15. Очищення причини очищає залежні поля.
16. Посилання «Черга читання» веде на правильну сторінку.
17. Карти пріоритету доступні з клавіатури.
18. Фокус і `aria-checked` оновлюються правильно.

## Submit

19. Високий без причини формує валідний payload.
20. Високий із причиною та датою формує валідний payload.
21. `other` із текстом формує валідний payload.
22. Порожній текст для `other` блокує submit.
23. `normal` не відправляє приховані значення.
24. `low` не відправляє приховані значення.
25. Порожній custom text перетворюється на `null`.
26. Дата передається без UTC-зміщення.

## Edit mode

27. Значення з API правильно гідратуються.
28. Старі записи без нових полів відкриваються без помилки.
29. Причина `other` відображає збережений текст.
30. Причина з датою відображає збережену дату.

---

# 31. Критерії готовності

Завдання вважається виконаним, якщо:

- пріоритет можна обрати через три картки;
- показується опис лише активного пріоритету;
- причина доступна лише для високого пріоритету;
- варіант `other` відкриває текстовий інпут;
- дата доступна лише для відповідних причин;
- залежні значення очищаються коректно;
- payload відповідає контракту бекенду;
- edit mode працює зі старими й новими записами;
- використані тільки Lucide-іконки;
- стилі побудовані на токенах поточної теми;
- блок адаптивний;
- додана примітка з посиланням на сторінку «Черга читання»;
- пріоритет не змінює позицію книги автоматично;
- реалізація покрита тестами.

---

# 32. Обмеження

- Не реалізовувати бекенд у межах цього завдання.
- Не змінювати поточну логіку сортування черги.
- Не переміщувати книгу автоматично після зміни пріоритету.
- Не додавати нові сторонні бібліотеки іконок.
- Не використовувати hardcoded-кольори замість theme tokens.
- Не дублювати конфігурацію пріоритетів у кількох компонентах.
- Не зберігати довільний текст у `queuePriorityReason`.
- Не відправляти приховані або застарілі значення полів.
- Якщо якогось endpoint або поля ще немає на бекенді, не реалізовувати серверну частину. Зафіксувати відсутній контракт окремо.
