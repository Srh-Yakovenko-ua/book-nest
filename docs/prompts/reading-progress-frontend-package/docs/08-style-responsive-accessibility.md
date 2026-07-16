# 8. Стиль, responsive та accessibility

## 8.1. Візуальний стиль BookNest

- теплий кремово-бежевий фон;
- теракотово-коричневий акцент через theme token, еквівалентний `#9A5D36`;
- світлі surfaces;
- м’які радіуси;
- тонкі теплі borders;
- делікатні shadows;
- достатньо повітря;
- ботанічні акценти лише якщо не заважають даним;
- без холодних яскравих кольорів;
- без важких темних таблиць;
- без зайвих badges;
- без чистого чорного, якщо theme має м’якший text color.

Використовувати theme tokens, наявні Button/Card/Chip/Progress компоненти. Не створювати новий visual language.

Chart має виглядати як частина BookNest, а не аналітичний dashboard.

## 8.2. Desktop

- блок займає ширину основної колонки під «Про книгу»;
- summary metrics в один row або grid;
- chart full width;
- day header в один ряд;
- event time, delta і final page можуть бути колонками.

## 8.3. Tablet

- metrics у 2 колонки;
- controls можуть переноситися;
- chart залишається читабельним.

## 8.4. Mobile

- section title і controls stack vertically;
- range control — full-width segmented або horizontal scroll;
- metrics у 1–2 колонки;
- day header у 2–3 рядки;
- event data stack, якщо бракує ширини;
- touch targets мінімум 44×44 px;
- без horizontal page scroll;
- chart tooltip доступний через tap;
- порядок секцій: «Про книгу» → прогрес → наступний контент.

## 8.5. Accessibility

Обов’язково:

- keyboard access для controls;
- accordion button: `aria-expanded`, `aria-controls`;
- tabs/segmented controls мають коректні roles;
- chart не є єдиним джерелом інформації;
- під chart є text summary;
- tooltip data доступна не лише через hover;
- progress bar: `role="progressbar"`, min/max/current value, зрозумілий aria-label;
- status не передається лише кольором;
- sufficient contrast;
- loading позначений для screen reader;
- errors/empty states читабельні;
- animations враховують `prefers-reduced-motion`.
