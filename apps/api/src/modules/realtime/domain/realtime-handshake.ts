import type { Nullable } from "@app/shared";

import { z } from "zod";

export type RealtimeHandshake = {
  authorizationHeader: unknown;
  handshakeAuth: unknown;
};

const BEARER_SCHEME = "bearer";

const SOURCE_BUCKET = {
  ipv4MappedPrefix: "::ffff:",
  ipv6Hextets: 8,
  ipv6NetworkHextets: 4,
  unknown: "unknown",
} as const satisfies Record<string, number | string>;

const HandshakeAuthSchema = z.object({ token: z.string().min(1) });

export function extractHandshakeToken({
  authorizationHeader,
  handshakeAuth,
}: RealtimeHandshake): Nullable<string> {
  const auth = HandshakeAuthSchema.safeParse(handshakeAuth);
  if (auth.success) {
    return auth.data.token;
  }
  return extractBearerToken(authorizationHeader);
}

export function isAllowedOrigin({
  allowedOrigins,
  origin,
}: {
  allowedOrigins: readonly string[];
  origin: unknown;
}): boolean {
  if (origin === undefined || origin === null || origin === "") {
    return true;
  }
  if (typeof origin !== "string") {
    return false;
  }
  return allowedOrigins.includes(origin);
}

export function resolveSourceBucket({
  forwardedFor,
  remoteAddress,
  trustForwardedHeader,
}: {
  forwardedFor: unknown;
  remoteAddress: unknown;
  trustForwardedHeader: boolean;
}): string {
  const nearestProxiedPeer = trustForwardedHeader ? readNearestForwardedPeer(forwardedFor) : null;
  if (nearestProxiedPeer !== null) {
    return toNetworkBucket(nearestProxiedPeer);
  }
  if (typeof remoteAddress === "string" && remoteAddress.length > 0) {
    return toNetworkBucket(remoteAddress);
  }
  return SOURCE_BUCKET.unknown;
}

function extractBearerToken(header: unknown): Nullable<string> {
  if (typeof header !== "string") {
    return null;
  }
  const [scheme, token, ...rest] = header.split(" ");
  if (
    rest.length !== 0 ||
    scheme === undefined ||
    scheme.toLowerCase() !== BEARER_SCHEME ||
    token === undefined ||
    token.length === 0
  ) {
    return null;
  }
  return token;
}

function ipv6NetworkBucket(address: string): string {
  const [head, tail] = address.split("::");
  const headHextets = (head ?? "").split(":").filter((hextet) => hextet.length > 0);
  const tailHextets = (tail ?? "").split(":").filter((hextet) => hextet.length > 0);
  const elided =
    tail === undefined
      ? 0
      : Math.max(0, SOURCE_BUCKET.ipv6Hextets - headHextets.length - tailHextets.length);
  const hextets = [
    ...headHextets,
    ...Array.from({ length: elided }, () => "0"),
    ...tailHextets,
  ].slice(0, SOURCE_BUCKET.ipv6NetworkHextets);

  return Array.from({ length: SOURCE_BUCKET.ipv6NetworkHextets }, (_slot, index) =>
    (hextets[index] ?? "0").replace(/^0+(?=.)/, ""),
  ).join(":");
}

function readNearestForwardedPeer(forwardedFor: unknown): Nullable<string> {
  if (typeof forwardedFor !== "string") {
    return null;
  }
  const peers = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return peers.at(-1) ?? null;
}

function toNetworkBucket(address: string): string {
  const withoutZone = address.split("%")[0] ?? address;
  const normalized = withoutZone.toLowerCase();
  const unmapped = normalized.startsWith(SOURCE_BUCKET.ipv4MappedPrefix)
    ? normalized.slice(SOURCE_BUCKET.ipv4MappedPrefix.length)
    : normalized;
  if (!unmapped.includes(":")) {
    return unmapped;
  }
  return ipv6NetworkBucket(unmapped);
}
