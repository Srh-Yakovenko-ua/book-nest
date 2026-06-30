const COMMON_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
] as const;

const MAX_DISTANCE = 2;

export function suggestEmailDomain(email: string): null | string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();

  if (COMMON_DOMAINS.includes(domain as (typeof COMMON_DOMAINS)[number])) return null;

  let best: null | string = null;
  let bestDistance = MAX_DISTANCE + 1;

  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    if (distance > 0 && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (best === null || bestDistance > MAX_DISTANCE) return null;
  return `${local}@${best}`;
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current.push(Math.min(deletion, insertion, substitution));
    }
    previous = current;
  }

  return previous[b.length] ?? 0;
}
