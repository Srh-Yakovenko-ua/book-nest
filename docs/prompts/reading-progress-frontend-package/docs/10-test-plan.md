# 10. План тестів

Використати поточний test stack проєкту.

## Component / unit tests

1. Compact block для `reading`.
2. Title `Reading summary` для `finished`.
3. `pagesCount = null`.
4. `progressPercent = null`.
5. Remaining visible для reading.
6. Remaining hidden для finished.
7. Duration для finished береться з response.
8. Paused state.
9. Abandoned/DNF neutral state.
10. Active days.
11. Average тільки коли non-null.
12. Best day тільки коли non-null.
13. Forecast тільки коли backend повернув value.
14. Forecast hidden для paused.
15. Forecast hidden для finished/DNF.
16. Incomplete-history notice.
17. Empty history.
18. Legacy progress without events.
19. Range control.
20. Correct params для `7d`.
21. Correct params для `14d`.
22. Correct params для `all`.
23. Chart отримує backend points без reaggregation.
24. Zero-day tooltip.
25. Recent activity максимум 3 day groups.
26. View full history navigation.
27. Full-history tab render.
28. Sort default `desc`.
29. Sort change resets page to 1.
30. Day accordion header.
31. Expanded day events.
32. Time hidden when `recordedAt` absent.
33. Pagination використовує backend metadata.
34. Page change відправляє correct page.
35. Initial skeleton.
36. Local refetch state.
37. Error + retry.
38. i18n pluralization.
39. Critical mobile layout.
40. Accordion ARIA.
41. Progressbar ARIA.
42. Keyboard interaction.
43. Block rendered under «Про книгу».
44. Block no longer rendered in sidebar.

## Integration tests

45. Progress mutation invalidates reading history.
46. Status mutation invalidates reading history when needed.
47. Switching book resets controls/accordion.
48. URL-driven tab opens directly, якщо tabs URL-driven.
49. Browser back/forward works for tab state.
50. Previous data remains visible during range refetch.
51. Invalid/empty page after data change handled safely.
52. Full flow: update progress → compact block, chart і history refresh.

## Quality commands

Запустити доступні релевантні команди:

- typecheck;
- lint;
- unit/component tests;
- integration tests;
- build, якщо це прийнято для завершення задачі.

Не приховувати failing tests або TypeScript errors.
