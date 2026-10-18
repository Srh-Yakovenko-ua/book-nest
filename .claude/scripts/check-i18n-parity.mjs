import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../../apps/web/src/messages/", import.meta.url));
const locales = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length))
  .sort();

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object"
      ? flattenKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const keysByLocale = locales.map((locale) => {
  const json = JSON.parse(readFileSync(`${dir}${locale}.json`, "utf8"));
  return new Set(flattenKeys(json));
});

const allKeys = new Set(keysByLocale.flatMap((set) => [...set]));

const missing = [...allKeys].flatMap((key) =>
  keysByLocale.flatMap((set, index) =>
    set.has(key) ? [] : [`[i18n] missing "${key}" in ${locales[index]}.json`],
  ),
);

if (missing.length === 0) {
  console.error("[i18n] locale files in sync");
} else {
  console.error(missing.slice(0, 20).join("\n"));
  if (missing.length > 20) console.error(`[i18n] +${missing.length - 20} more`);
  process.exitCode = 2;
}
