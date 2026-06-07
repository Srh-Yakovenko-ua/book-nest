---
name: add-i18n-key
description: Add (or rename/remove) a next-intl translation key across all three locale files in apps/web/src/messages (ru, en, uk) at once, keeping them in sync and translated. Use when adding user-facing text to apps/web so a key never lands in one locale but not the others.
---

# Add an i18n key (apps/web, next-intl)

The frontend uses next-intl with three locale catalogs that MUST stay in structural sync — a key present in one file but missing from another causes a fallback or a runtime error. The default locale is `ru`.

```
apps/web/src/messages/ru.json   # ru — default, author source text here first
apps/web/src/messages/en.json   # en
apps/web/src/messages/uk.json   # uk
```

## Steps

1. **Confirm the key path and namespace.** Keys are dot-namespaced by feature/area (e.g. `home.title`, `nav.home`, `localePicker.ariaLabel`). Reuse an existing namespace when the text belongs to it; create a new top-level namespace only for a genuinely new area. Ask the user for the source text if not given.

2. **Add the key to all three files at the same path**, preserving the existing object nesting and key ordering of each file. Provide a real translation per locale:
   - `ru` — the source text (or the user's Russian text).
   - `en` — natural English, not a literal gloss.
   - `uk` — natural Ukrainian.
     If you are not confident in a translation, add it and flag it in your report rather than leaving the key absent.

3. **No placeholders left untranslated.** Every locale gets a real string. Keep ICU/interpolation syntax (`{name}`, plurals) identical across locales.

4. **Verify parity and format:**

   ```bash
   node .claude/scripts/check-i18n-parity.mjs        # must print "locale files in sync"
   pnpm exec prettier --write apps/web/src/messages/*.json
   ```

   (The PostToolUse hook also runs the parity check automatically on edit.)

5. **Use it in code** via next-intl: `const t = useTranslations("<namespace>")` then `t("<key>")` (works in server and client components); `getTranslations` in async server code and `generateMetadata`. Never read locale text from localStorage or hardcode user-facing strings.

## Rules

- All three files always change together. Never edit one locale alone.
- Don't reorder or reformat unrelated keys — keep the diff minimal.
- No comments in JSON. Match each file's existing structure exactly.
