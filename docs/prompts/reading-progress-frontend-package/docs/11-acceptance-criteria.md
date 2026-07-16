# 11. Acceptance criteria

Задача завершена, якщо:

1. Блок прогресу прибраний із правого sidebar.
2. Блок знаходиться в основній колонці одразу під «Про книгу».
3. Для finished title змінюється на «Підсумок читання».
4. Current page, total pages, percent і bar використовують backend values.
5. Status-specific dates відображаються коректно.
6. Active days, average і best day приходять із backend response.
7. Forecast показується лише за backend value і дозволеним status.
8. Є activity chart для 7d/14d/all.
9. Zero-activity days відображаються коректно.
10. Range change виконує server query.
11. Recent activity містить максимум 3 grouped days.
12. CTA відкриває підтабу повної історії.
13. Додано підтабу `Повна історія читання`.
14. Full tab має summary, chart і all updates.
15. History використовує вже grouped days.
16. Day accordion показує events.
17. Event показує pagesRead, final page і recordedAt, якщо доступний.
18. Events не називаються reading sessions.
19. Sort виконується server-side.
20. Pagination виконується server-side за day groups.
21. Frontend не виконує бізнес-агрегацій.
22. Progress/status mutations оновлюють усі reading-history views.
23. Є initial loading, local refetch, error, retry, empty, legacy і incomplete-history states.
24. UI адаптивний для desktop/tablet/mobile.
25. Компоненти відповідають стилю BookNest і використовують theme tokens.
26. UA/EN тексти винесені в i18n.
27. Pluralization і date-only formatting коректні.
28. Keyboard і ARIA requirements виконані.
29. Використано generated/shared API types.
30. Не додано непотрібну chart dependency.
31. Немає монолітного component-файлу.
32. Немає дублювання блока у main content і sidebar.
33. Немає console, TypeScript або lint errors.
34. Тести проходять.
35. Поточні update-progress і status flows не зламані.
36. Реалізація не є статичним макетом і працює з реальним API.
