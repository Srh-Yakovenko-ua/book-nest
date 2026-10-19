import { z } from "zod";

type ArrayParseState = {
  ctx: z.core.ParseContextInternal;
  element: z.core.$ZodType;
  items: readonly unknown[];
  parsedItems: unknown[];
  payload: z.core.ParsePayload;
};

const ZodBoundedArray = z.core.$constructor(
  "ZodBoundedArray",
  (inst: z.ZodArray, def: z.core.$ZodArrayDef) => {
    z.ZodArray.init(inst, def);
    const parseEveryElement = inst._zod.parse;
    inst._zod.parse = (payload, ctx) => {
      if (!Array.isArray(payload.value)) {
        return parseEveryElement(payload, ctx);
      }
      const items: readonly unknown[] = payload.value;
      const maxLength = inst._zod.bag.maximum;
      if (typeof maxLength === "number" && items.length > maxLength) {
        return payload;
      }
      return parseUntilFirstIssue({
        startIndex: 0,
        state: { ctx, element: def.element, items, parsedItems: [], payload },
      });
    };
  },
);

export function boundedArray<TElement extends z.ZodType>(
  element: TElement,
  maxLength: number,
): z.ZodArray<TElement> {
  const schema = new ZodBoundedArray({ element, type: "array" }).max(maxLength, { abort: true });
  return schema as z.ZodArray<TElement>;
}

function acceptElement({
  index,
  result,
  state,
}: {
  index: number;
  result: z.core.ParsePayload;
  state: ArrayParseState;
}): boolean {
  if (result.issues.length > 0) {
    state.payload.issues.push(...z.core.util.prefixIssues(index, result.issues));
    return false;
  }
  state.parsedItems.push(result.value);
  return true;
}

function parseUntilFirstIssue({
  startIndex,
  state,
}: {
  startIndex: number;
  state: ArrayParseState;
}): z.core.util.MaybeAsync<z.core.ParsePayload> {
  for (let index = startIndex; index < state.items.length; index += 1) {
    const result = state.element._zod.run({ issues: [], value: state.items[index] }, state.ctx);
    if (result instanceof Promise) {
      return result.then((settled) =>
        acceptElement({ index, result: settled, state })
          ? parseUntilFirstIssue({ startIndex: index + 1, state })
          : state.payload,
      );
    }
    if (!acceptElement({ index, result, state })) {
      return state.payload;
    }
  }
  state.payload.value = state.parsedItems;
  return state.payload;
}
