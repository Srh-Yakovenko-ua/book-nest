import type { Nullable } from "@app/shared";

const JSON_BYTE = {
  backslash: 0x5c,
  closeBrace: 0x7d,
  closeBracket: 0x5d,
  comma: 0x2c,
  openBrace: 0x7b,
  openBracket: 0x5b,
  quote: 0x22,
} as const;

export function exceedsJsonValueBudget({
  body,
  maxObjectMembers,
  maxValues,
}: {
  body: Uint8Array;
  maxObjectMembers: number;
  maxValues: number;
}): boolean {
  const objectMemberCounts: Nullable<number>[] = [];
  let valueCount = 0;
  let isInsideString = false;
  let isEscaped = false;
  for (let offset = 0; offset < body.length; offset += 1) {
    const byte = body[offset];
    if (isInsideString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (byte === JSON_BYTE.backslash) {
        isEscaped = true;
      } else if (byte === JSON_BYTE.quote) {
        isInsideString = false;
      }
      continue;
    }
    if (byte === JSON_BYTE.quote) {
      isInsideString = true;
      continue;
    }
    if (byte === JSON_BYTE.closeBrace || byte === JSON_BYTE.closeBracket) {
      objectMemberCounts.pop();
      continue;
    }
    if (
      byte !== JSON_BYTE.openBrace &&
      byte !== JSON_BYTE.openBracket &&
      byte !== JSON_BYTE.comma
    ) {
      continue;
    }
    valueCount += 1;
    if (valueCount > maxValues) {
      return true;
    }
    if (byte === JSON_BYTE.openBrace) {
      objectMemberCounts.push(1);
      continue;
    }
    if (byte === JSON_BYTE.openBracket) {
      objectMemberCounts.push(null);
      continue;
    }
    const enclosingMembers = objectMemberCounts.at(-1);
    if (enclosingMembers === undefined || enclosingMembers === null) {
      continue;
    }
    if (enclosingMembers + 1 > maxObjectMembers) {
      return true;
    }
    objectMemberCounts[objectMemberCounts.length - 1] = enclosingMembers + 1;
  }
  return false;
}
