"use client";

import { createSerializer, useQueryStates } from "nuqs";

import { RELATIONSHIP_LIST_PARSERS } from "./relationship-list-query";

const serializeRelationshipListState = createSerializer(RELATIONSHIP_LIST_PARSERS);

export function useRelationshipListSearch(): URLSearchParams {
  const [state] = useQueryStates(RELATIONSHIP_LIST_PARSERS);
  return new URLSearchParams(serializeRelationshipListState(state));
}
