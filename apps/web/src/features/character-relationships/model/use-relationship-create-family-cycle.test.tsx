import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import type { CreateOrientation, RelationshipCreateDraft } from "./relationship-create-semantics";
import type { RelationshipParticipant } from "./relationship-form-schema";

import {
  toEffectiveCreateEdgeSignature,
  toRelationshipCreateSemantics,
} from "./relationship-create-semantics";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";
import { useRelationshipCreateFamilyCycle } from "./use-relationship-create-family-cycle";

type DraftChange = Partial<RelationshipCreateDraft>;

const GERALT: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.geralt };
const CIRI: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.ciri };
const YENNEFER: RelationshipParticipant = { avatarUrl: null, ...RELATIONSHIP_FIXTURE.yennefer };
const PARENT_OF: DraftChange = { type: "biological_parent_of" };

function renderWarnedFamilyCycle(signature: string) {
  const view = renderHook(
    ({ semanticKey }: { semanticKey: string }) => useRelationshipCreateFamilyCycle(semanticKey),
    { initialProps: { semanticKey: signature } },
  );
  act(() => view.result.current.report(true));
  return view;
}

function signatureOf(change: DraftChange, orientation: CreateOrientation = "forward"): string {
  const semantics = toRelationshipCreateSemantics({
    draft: {
      bookId: RELATIONSHIP_FIXTURE.book.id,
      customType: "",
      directionality: "symmetric",
      source: GERALT,
      target: CIRI,
      type: "biological_parent_of",
      ...change,
    },
    orientation,
  });
  if (semantics === null) throw new Error("The create draft is incomplete");
  return toEffectiveCreateEdgeSignature(semantics);
}

describe("useRelationshipCreateFamilyCycle", () => {
  it.each([
    { name: "a warning", overridable: true },
    { name: "a conflict", overridable: false },
  ])("R26 records whether $name can be overridden", ({ overridable }) => {
    const { result } = renderHook(() => useRelationshipCreateFamilyCycle(signatureOf(PARENT_OF)));

    act(() => result.current.report(overridable));

    expect(result.current.warning).toEqual({ overridable });
  });

  it("R26 keeps the warning while the semantics stay the same", () => {
    const { rerender, result } = renderWarnedFamilyCycle(signatureOf(PARENT_OF));

    rerender({ semanticKey: signatureOf(PARENT_OF) });

    expect(result.current.warning).toEqual({ overridable: true });
  });

  it.each<{ change: DraftChange; name: string; orientation: CreateOrientation }>([
    { change: PARENT_OF, name: "the direction radio", orientation: "reverse" },
    { change: { type: "mentor_of" }, name: "the type", orientation: "forward" },
    { change: { ...PARENT_OF, target: YENNEFER }, name: "a participant", orientation: "forward" },
    {
      change: { ...PARENT_OF, bookId: RELATIONSHIP_FIXTURE.secondBook.id },
      name: "the book",
      orientation: "forward",
    },
  ])("P14 R26 drops the warning when $name changes", ({ change, orientation }) => {
    const { rerender, result } = renderWarnedFamilyCycle(signatureOf(PARENT_OF));

    rerender({ semanticKey: signatureOf(change, orientation) });

    expect(result.current.warning).toBeNull();
  });

  it("P14 R26 does not bring the old warning back when the radio returns to forward", () => {
    const { rerender, result } = renderWarnedFamilyCycle(signatureOf(PARENT_OF));

    rerender({ semanticKey: signatureOf(PARENT_OF, "reverse") });
    rerender({ semanticKey: signatureOf(PARENT_OF) });

    expect(result.current.warning).toBeNull();
  });

  it("P05 P14 keeps the warning through a clean A/B swap that keeps the effective endpoints", () => {
    const { rerender, result } = renderWarnedFamilyCycle(signatureOf(PARENT_OF));

    rerender({
      semanticKey: signatureOf({ ...PARENT_OF, source: CIRI, target: GERALT }, "reverse"),
    });

    expect(result.current.warning).toEqual({ overridable: true });
  });

  it("R26 clears the warning on request", () => {
    const { result } = renderWarnedFamilyCycle(signatureOf(PARENT_OF));

    act(() => result.current.clear());

    expect(result.current.warning).toBeNull();
  });
});
