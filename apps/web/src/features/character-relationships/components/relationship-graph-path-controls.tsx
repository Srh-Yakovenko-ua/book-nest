"use client";

import type { CharacterGraphNodeView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assertNever } from "@/lib/assert-never";

import type {
  RelationshipGraphPathEndpoints,
  RelationshipGraphPathState,
} from "../model/relationship-graph-path";

type EndpointKey = keyof RelationshipGraphPathEndpoints;

type RelationshipGraphPathControlsProps = {
  characters: CharacterGraphNodeView[];
  endpoints: RelationshipGraphPathEndpoints;
  onChange: (next: RelationshipGraphPathEndpoints) => void;
  onRetry: () => void;
  state: RelationshipGraphPathState;
};

const PATH_ENDPOINTS = [
  { key: "fromId", labelKey: "from" },
  { key: "toId", labelKey: "to" },
] as const satisfies readonly { key: EndpointKey; labelKey: string }[];

export function RelationshipGraphPathControls({
  characters,
  endpoints,
  onChange,
  onRetry,
  state,
}: RelationshipGraphPathControlsProps) {
  const t = useTranslations("relationships.graph.path");
  const headingId = useId();
  const isUnavailable = state.kind === "unavailable";

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground" id={headingId}>
        {t("title")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {PATH_ENDPOINTS.map((endpoint) => {
          const labelId = `${headingId}-${endpoint.key}`;
          return (
            <div className="flex min-w-0 flex-col gap-1.5" key={endpoint.key}>
              <span className="text-xs font-medium text-muted-foreground" id={labelId}>
                {t(endpoint.labelKey)}
              </span>
              <Select
                disabled={isUnavailable}
                onValueChange={(next) => onChange({ ...endpoints, [endpoint.key]: next })}
                value={endpoints[endpoint.key] ?? ""}
              >
                <SelectTrigger
                  aria-labelledby={labelId}
                  className="w-full"
                  clearLabel={t("clear")}
                  isClearable={endpoints[endpoint.key] !== null}
                  onClear={() => onChange({ ...endpoints, [endpoint.key]: null })}
                >
                  <SelectValue placeholder={t("placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {characters.map((character) => (
                    <SelectItem key={character.id} value={character.id}>
                      {character.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      <div aria-live="polite" className="text-sm text-muted-foreground" role="status">
        <PathStatus onRetry={onRetry} state={state} />
      </div>
    </section>
  );
}

function PathStatus({
  onRetry,
  state,
}: {
  onRetry: () => void;
  state: RelationshipGraphPathState;
}) {
  const t = useTranslations("relationships.graph.path");

  switch (state.kind) {
    case "error":
      return (
        <span className="flex flex-wrap items-center gap-2 text-error">
          {t("error")}
          <Button onClick={onRetry} size="xs" variant="secondary">
            <UiIcon name="refresh" size={12} />
            {t("retry")}
          </Button>
        </span>
      );
    case "found":
      return (
        <div className="flex flex-col gap-1">
          <span className="text-foreground">{t("found", { count: state.steps.length - 1 })}</span>
          <ol aria-label={t("sequence")} className="flex flex-wrap items-center gap-1">
            {state.steps.map((step, index) => (
              <li className="flex items-center gap-1" key={step.id}>
                {index === 0 ? null : <UiIcon name="arrow-right" size={12} />}
                <span className="font-medium text-primary">{step.name}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "idle":
      return t("idle");
    case "loading":
      return t("loading");
    case "notFound":
      return t("notFound");
    case "sameCharacter":
      return t("sameCharacter");
    case "unavailable":
      return t("unavailable");
    default:
      return assertNever(state);
  }
}
