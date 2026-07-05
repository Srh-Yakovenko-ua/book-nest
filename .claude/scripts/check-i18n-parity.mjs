import { readdirSync, readFileSync } from "node:fs";

const dir = "apps/web/src/messages";
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
  const json = JSON.parse(readFileSync(`${dir}/${locale}.json`, "utf8"));
  return new Set(flattenKeys(json));
});

const allKeys = new Set(keysByLocale.flatMap((set) => [...set]));

let drift = false;
for (const key of allKeys) {
  keysByLocale.forEach((set, index) => {
    if (!set.has(key)) {
      drift = true;
      console.error(`[i18n] missing "${key}" in ${locales[index]}.json`);
    }
  });
}

if (!drift) console.error("[i18n] locale files in sync");
