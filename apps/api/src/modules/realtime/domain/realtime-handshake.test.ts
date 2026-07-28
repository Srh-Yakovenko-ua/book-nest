import { describe, expect, it } from "vitest";

import {
  extractHandshakeToken,
  isAllowedOrigin,
  resolveSourceBucket,
} from "./realtime-handshake.js";

describe("extractHandshakeToken", () => {
  it("prefers the socket.io handshake auth payload", () => {
    const token = extractHandshakeToken({
      authorizationHeader: "Bearer header-token",
      handshakeAuth: { token: "auth-token" },
    });

    expect(token).toBe("auth-token");
  });

  it("falls back to the Authorization bearer header", () => {
    const token = extractHandshakeToken({
      authorizationHeader: "Bearer header-token",
      handshakeAuth: {},
    });

    expect(token).toBe("header-token");
  });

  it("accepts a lowercase bearer scheme", () => {
    const token = extractHandshakeToken({
      authorizationHeader: "bearer header-token",
      handshakeAuth: undefined,
    });

    expect(token).toBe("header-token");
  });

  it("returns null when neither source carries a token", () => {
    const token = extractHandshakeToken({
      authorizationHeader: undefined,
      handshakeAuth: {},
    });

    expect(token).toBeNull();
  });

  it("returns null for an empty handshake token", () => {
    const token = extractHandshakeToken({
      authorizationHeader: undefined,
      handshakeAuth: { token: "" },
    });

    expect(token).toBeNull();
  });

  it("returns null for a non-bearer authorization scheme", () => {
    const token = extractHandshakeToken({
      authorizationHeader: "Basic header-token",
      handshakeAuth: {},
    });

    expect(token).toBeNull();
  });

  it("returns null for a malformed authorization header with extra segments", () => {
    const token = extractHandshakeToken({
      authorizationHeader: "Bearer one two",
      handshakeAuth: {},
    });

    expect(token).toBeNull();
  });

  it("ignores a non-string handshake token", () => {
    const token = extractHandshakeToken({
      authorizationHeader: undefined,
      handshakeAuth: { token: 42 },
    });

    expect(token).toBeNull();
  });
});

describe("isAllowedOrigin", () => {
  const allowedOrigins = ["http://localhost:3000", "https://book-nest.net"];

  it("allows a handshake without an origin header", () => {
    expect(isAllowedOrigin({ allowedOrigins, origin: undefined })).toBe(true);
  });

  it("allows an empty origin header", () => {
    expect(isAllowedOrigin({ allowedOrigins, origin: "" })).toBe(true);
  });

  it("allows an origin present in the allow list", () => {
    expect(isAllowedOrigin({ allowedOrigins, origin: "https://book-nest.net" })).toBe(true);
  });

  it("rejects an origin outside the allow list", () => {
    expect(isAllowedOrigin({ allowedOrigins, origin: "https://evil.example" })).toBe(false);
  });

  it("rejects a case-mismatched origin", () => {
    expect(isAllowedOrigin({ allowedOrigins, origin: "https://BOOK-NEST.net" })).toBe(false);
  });

  it("rejects a non-string origin", () => {
    expect(isAllowedOrigin({ allowedOrigins, origin: ["http://localhost:3000"] })).toBe(false);
  });
});

describe("resolveSourceBucket", () => {
  const behindProxy = { trustForwardedHeader: true };
  const directlyExposed = { trustForwardedHeader: false };

  it("falls back to the socket peer when no proxy header is present", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: undefined,
        remoteAddress: "203.0.113.7",
      }),
    ).toBe("203.0.113.7");
  });

  it("takes the rightmost forwarded entry, which is the one the trusted proxy appended", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: "203.0.113.9, 198.51.100.4",
        remoteAddress: "172.18.0.2",
      }),
    ).toBe("198.51.100.4");
  });

  it("ignores a spoofed leftmost entry supplied by the client", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: "1.2.3.4, 203.0.113.7",
        remoteAddress: "172.18.0.2",
      }),
    ).not.toBe("1.2.3.4");
  });

  it("tolerates padding around forwarded entries", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: " 1.2.3.4 ,  203.0.113.7 ",
        remoteAddress: undefined,
      }),
    ).toBe("203.0.113.7");
  });

  it("falls back to the socket peer for an empty forwarded header", () => {
    expect(
      resolveSourceBucket({ ...behindProxy, forwardedFor: "", remoteAddress: "203.0.113.7" }),
    ).toBe("203.0.113.7");
  });

  it("falls back to a single bucket when neither source is usable", () => {
    expect(
      resolveSourceBucket({ ...behindProxy, forwardedFor: undefined, remoteAddress: undefined }),
    ).toBe("unknown");
  });

  it("ignores the forwarded header entirely when no proxy is trusted", () => {
    expect(
      resolveSourceBucket({
        ...directlyExposed,
        forwardedFor: "1.2.3.4",
        remoteAddress: "203.0.113.7",
      }),
    ).toBe("203.0.113.7");
  });

  it("cannot be rotated through the forwarded header when no proxy is trusted", () => {
    const buckets = ["9.9.9.1", "9.9.9.2", "9.9.9.3"].map((spoofed) =>
      resolveSourceBucket({
        ...directlyExposed,
        forwardedFor: spoofed,
        remoteAddress: "203.0.113.7",
      }),
    );

    expect(new Set(buckets).size).toBe(1);
  });

  it("buckets an ipv6 source by its /64 network", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: undefined,
        remoteAddress: "2001:db8:abcd:1234:5678:9abc:def0:1111",
      }),
    ).toBe("2001:db8:abcd:1234");
  });

  it("gives every host inside one ipv6 /64 the same bucket", () => {
    const buckets = ["2001:db8:abcd:1234::1", "2001:db8:abcd:1234::dead:beef"].map((address) =>
      resolveSourceBucket({ ...behindProxy, forwardedFor: undefined, remoteAddress: address }),
    );

    expect(new Set(buckets).size).toBe(1);
  });

  it("separates distinct ipv6 /64 networks", () => {
    const first = resolveSourceBucket({
      ...behindProxy,
      forwardedFor: undefined,
      remoteAddress: "2001:db8:abcd:1234::1",
    });
    const second = resolveSourceBucket({
      ...behindProxy,
      forwardedFor: undefined,
      remoteAddress: "2001:db8:abcd:9999::1",
    });

    expect(first).not.toBe(second);
  });

  it("normalizes compressed and padded ipv6 spellings to the same bucket", () => {
    const buckets = ["2001:0db8:0000:0001::5", "2001:db8:0:1::9"].map((address) =>
      resolveSourceBucket({ ...behindProxy, forwardedFor: undefined, remoteAddress: address }),
    );

    expect(new Set(buckets).size).toBe(1);
  });

  it("treats an ipv4-mapped ipv6 address as its ipv4 host", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: undefined,
        remoteAddress: "::ffff:203.0.113.7",
      }),
    ).toBe("203.0.113.7");
  });

  it("strips an ipv6 zone identifier", () => {
    expect(
      resolveSourceBucket({
        ...behindProxy,
        forwardedFor: undefined,
        remoteAddress: "fe80::1%eth0",
      }),
    ).toBe("fe80:0:0:0");
  });
});
