# 5. Компактний блок «Прогрес читання»

## 5.1. Розташування

Блок знаходиться у головній контентній колонці **відразу під «Про книгу»**. Він більше не знаходиться у правому sidebar.

## 5.2. Заголовок

- `reading`, `paused`, `abandoned`/`dnf` → UA `Прогрес читання`, EN `Reading progress`.
- `finished` → UA `Підсумок читання`, EN `Reading summary`.

DNF не оформлювати як помилку або провину користувача.

## 5.3. Верхня частина

Якщо `pagesCount` відома:

```text
250 із 320 сторінок                         78%
[progress bar]
```

Якщо `pagesCount === null`:

```text
Сторінка 250
```

У цьому випадку:

- не показувати fake percent;
- не показувати determinate bar;
- не показувати pages remaining;
- neutral/indeterminate visual дозволений лише якщо він відповідає дизайн-системі.

Для finished progress bar заповнений повністю, якщо percent доступний.

## 5.4. Основні дати

### Reading

- `Почато` → `startedAt` або `readingPeriod.startDate`;
- `Оновлено` → `lastProgressUpdateAt`;
- `Залишилося` → `pagesRemaining`.

### Finished

- `Почато`;
- `Завершено`;
- `Тривалість` → тільки `readingPeriod.calendarDays`.

### Paused

- `Почато`;
- `На паузі з`;
- `Зупинка` → current/final page із response.

### Abandoned / DNF

- `Почато`;
- `Припинено`;
- `Зупинка`.

## 5.5. Ключова статистика

Показати до трьох items:

1. active days;
2. average pages per active day;
3. best day.

Приклади:

```text
6 активних днів
42 стор./активний день
84 стор. — найкращий день
```

Для best day дату показати secondary text або tooltip.

Не показувати item, якщо відповідне значення `null`. Не замінювати `null` нулем.

## 5.6. Forecast

Показувати тільки якщо backend повернув `estimatedActiveDaysRemaining !== null` і статус дозволяє прогноз.

UA:

```text
За поточного темпу залишилося приблизно {{count}} активних днів читання.
```

EN:

```text
At the current pace, about {{count}} active reading days remain.
```

Не показувати для paused, finished, abandoned/dnf, unknown pages count або недостатніх даних.

Оформити як теплий info strip, не як error/primary alert.

## 5.7. Неповна історія

Якщо history incomplete і є untracked progress:

UA:

```text
Частина раніше збереженого прогресу не має детальної історії оновлень.
```

Hint:

```text
Графік і статистика активності побудовані лише за зафіксованими оновленнями.
```

Не показувати `untrackedPages` як помилку користувача.

## 5.8. Активність читання

Header:

```text
Активність читання      [7 днів] [14 днів] [Увесь період]
```

Values: `7d | 14d | all`, default `7d`.

При range change виконати server query. Локально не перебудовувати dataset.

### Tooltip active day

```text
12 бер. 2026
35 сторінок
3 оновлення
Від сторінки 215 до 250
```

Останній рядок показувати лише коли start/final page доступні.

### Tooltip zero day

```text
11 бер. 2026
Без оновлень
```

### Summary під chart

Використати лише `activity.summary`:

```text
3 активні дні · 167 сторінок · 55,7 стор./активний день
```

## 5.9. Остання активність

Показати максимум три перші day groups із `history.days` при `sort=desc`.

Формат:

```text
12 бер. 2026     +35 сторінок     До сторінки 250
3 оновлення
```

Не показувати individual events у compact block.

Кнопка:

- UA `Переглянути повну історію`;
- EN `View full history`.

Вона відкриває відповідну підтабу, а не modal.
