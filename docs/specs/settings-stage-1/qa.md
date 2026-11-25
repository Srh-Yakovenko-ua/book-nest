# Settings stage 1: live QA results

The acceptance matrix from `spec.md` §3, run against a local stack on 2026-11-25. Every row was driven by headless Chromium (Playwright from `apps/web/node_modules`) with real clicks and keys, and each result below is what the run printed.

## Stack

- Worktree `D:\IT\book-nest-settings-stage-1`, branch `refactor/settings-stage-1`, base origin/dev `7aeb25f4`.
- Web: `next dev -p 3002` from `apps/web` with `API_BASE_URL=http://localhost:4102`.
- API: `apps/api` started with `APP_ENV=settings-s1.local` (gitignored env file) on port 4102, against the scratch database `booknest_settings_s1` (empty database plus all migrations). Redis and Mailpit are the local Docker containers.
- Accounts: `settings-s1-qa@example.com`, `settings-s1-qa2@example.com` and `settings-s1-qa3@example.com`, all registered and verified through the local Mailpit inbox. The first one holds one book and one order so the delivery statistics calendar renders.

## Matrix

| Scenario                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First visit and reload    | Two cards, «Нагадування» then «Дата й календар», no «Скоро» rows. Server values come back after a reload. With the settings GET held for 6 s, a status region reads «Завантаження налаштувань…» over a skeleton of two cards at 360 and 1280. With the GET forced to 500, an alert «Не вдалося завантажити налаштування» appears, and «Спробувати ще раз» brings both cards back once the GET succeeds.                                                                                                                                                                        |
| Delivery and return       | Each switch sends only its own field, for example `{"emailNotifications":{"deliveryReminders":false}}`. With both email switches off the lead-days select stays enabled and saves. Values 14, 1, 2 and 5 each saved with exactly one PATCH. Picking the stored value sent nothing. Typing "14" on the closed, focused select sends nothing (before the fix it sent 11 and then 14).                                                                                                                                                                                            |
| Quick changes and failure | With every PATCH delayed by 1.5 s, a switch change followed by a lead-days change showed both pending values, sent `{"emailNotifications":{"deliveryReminders":true}}` then `{"loanReminderLeadDays":7}` in that order, and both survived a reload. With the lead-days PATCH forced to 500, only that row went back to 7 and showed «Не вдалося зберегти.» with «Повторити», while the queued switch change still saved. «Повторити» then saved 10 and kept keyboard focus on the field.                                                                                       |
| Time zone                 | «Київ», «Kyiv», «Kiev» and «Europe/Kyiv» each made «Київ · UTC+02:00» the first and active option. «Варша» found «Варшава · UTC+01:00», «нью йорк» found «Нью-Йорк». «zzzz» showed «Нічого не знайдено» through a status region. Escape closed the list, returned focus to the trigger and cleared the query. ArrowDown then Enter saved `{"timezone":"Europe/London"}` with one PATCH. After a reload the saved zone is on the trigger and first in the list, listed once. A stored legacy `Europe/Kiev` shows as «Київ · UTC+02:00» and opening the list sends nothing.      |
| First day of the week     | The preview reads «пн вт ср чт пт сб нд» and turns into «нд пн вт ср чт пт сб» as soon as Sunday is chosen, before the save returns. The PATCH is `{"weekStartDay":"sunday"}` alone. The delivery statistics calendar labels its rows «нд вт чт сб» after Sunday and «пн ср пт нд» after Monday.                                                                                                                                                                                                                                                                               |
| Test notification         | A forced 500 showed «Не вдалося створити тестове сповіщення. Спробуйте ще раз.» and the button stayed usable. During a delayed request the button kept focus with `aria-busy="true"`, and Enter plus a click sent one POST. After the 202 the page showed «Тестове сповіщення створено. Перевірте дзвіночок.» A fourth request within a minute showed the limit message. On fresh accounts the bell went from 0 to 1 unread both with the email switches on and off. The local Mailpit inbox got one «Нагадування BookNest» email with the switches on and none with them off. |
| Layout and accessibility  | No horizontal scroll at 360 and 1280 wide, in uk and en, light and dark. On a 360 x 740 screen the time zone list stays inside the viewport and scrolls. Tab reaches both switches, the lead-days select, the test button, the time zone trigger and the week radio group, each with a visible focus ring. The active time zone option has a 2 px inset ring in both themes. Save errors are visible in both themes.                                                                                                                                                           |

## The 202 response

`curl -i -X POST /api/notifications/test` with a bearer token, through the web proxy and straight against the API:

```
HTTP/1.1 202 Accepted
x-request-id: 7cc983c7-9eee-4881-be72-e3387252f5c9
transfer-encoding: chunked

HTTP/1.1 202 Accepted
x-request-id: 24f1f091-35a9-4e6c-9231-a892b870fa4c
```

Both bodies are empty. Before the `http-client` change the client called `res.json()` on this body, threw `SyntaxError` and showed an error although the notification was created.

## Notes

- The backend deduplicates the test notification per user and hour (`test:<user>:<isoHour>`) and sends at most one digest email per hour, so a second test within the same hour marks the existing bell item unread again and sends no new email. The email checks therefore used fresh accounts. This is existing API behaviour, outside this stage.
- The dev-only React Scan and Next overlays were hidden in the screenshots. They are not part of the page.
