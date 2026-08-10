---
name: add-i18n-key
description: Add (or rename/remove) a next-intl translation key across both locale catalogs in apps/web/src/messages (uk, en) at once, keeping them in structural sync and genuinely translated. Use when adding user-facing text to apps/web so a key never lands in one locale but not the other.
---

# Add an i18n key (apps/web, next-intl)

The frontend uses next-intl with two locale catalogs that MUST stay in structural sync — a key present in one file but missing from the other causes a fallback or a runtime error. The default locale is `uk`.

```
apps/web/src/messages/uk.json   # uk — default, author source text here first
apps/web/src/messages/en.json   # en
```

There is no `ru.json`. Russian was dropped as a shipping locale; the user writes to you in Russian, but the product does not ship it. Creating `ru.json` breaks the parity check, because the checker discovers locales from the directory listing rather than from a hardcoded list.

## Steps

1. **Confirm the key path and namespace.** Keys are dot-namespaced by feature/area (e.g. `home.title`, `nav.home`, `localePicker.ariaLabel`). Reuse an existing namespace when the text belongs to it; create a new top-level namespace only for a genuinely new area. Ask the user for the source text if not given.

2. **Add the key to both files at the same path**, preserving each file's existing object nesting and key ordering. Provide a real translation per locale:
   - `uk` — natural Ukrainian; this is the default locale and the one most users read.
   - `en` — natural English, not a literal gloss.

   If the user supplied the text in Russian, translate it into both — do not paste the Russian in as a placeholder. If you are not confident in a translation, add it and flag it in your report rather than leaving the key absent.

3. **No placeholders left untranslated.** Every locale gets a real string. Keep ICU/interpolation syntax (`{name}`, plurals) identical across locales.

4. **Verify parity and format:**

   ```bash
   node .claude/scripts/check-i18n-parity.mjs        # must print "locale files in sync"
   pnpm exec prettier --write apps/web/src/messages/*.json
   ```

   (The PostToolUse hook also runs the parity check automatically on edit.)

5. **Use it in code** via next-intl: `const t = useTranslations("<namespace>")` then `t("<key>")` (works in server and client components); `getTranslations` in async server code and `generateMetadata`. Never read locale text from localStorage or hardcode user-facing strings.

## Rules

- Both files always change together. Never edit one locale alone.
- Never add a third locale file on your own initiative. Adding a locale is a routing, metadata, hreflang and sitemap change, not a JSON file.
- Don't reorder or reformat unrelated keys — keep the diff minimal.
- No comments in JSON. Match each file's existing structure exactly.
