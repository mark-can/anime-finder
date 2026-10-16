import assert from "node:assert/strict";
import test from "node:test";
import { authorizeUrl, parseAuthFragment, tokenExpiry } from "../src/auth.js";

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (payload) => `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url(payload)}.signature`;
const NOW = Date.UTC(2026, 9, 16);

test("the token's own exp claim sets the expiry", () => {
  const exp = NOW / 1_000 + 3_600;
  assert.equal(tokenExpiry(jwt({ exp }), "31536000", NOW), exp * 1_000);
});

test("expires_in is the fallback when the token is not a readable JWT", () => {
  assert.equal(tokenExpiry("opaque", "60", NOW), NOW + 60_000);
  assert.equal(tokenExpiry("opaque", null, NOW), null);
});

test("an AniList redirect fragment yields the token", () => {
  const token = jwt({ exp: NOW / 1_000 + 3_600 });
  const result = parseAuthFragment(`#access_token=${token}&token_type=Bearer&expires_in=31536000`, NOW);
  assert.equal(result.token, token);
  assert.equal(result.expiresAt, NOW + 3_600_000);
});

test("fragments without a usable token are rejected or ignored", () => {
  assert.equal(parseAuthFragment("", NOW), null);
  assert.equal(parseAuthFragment("#section-ur", NOW), null);
  assert.deepEqual(parseAuthFragment("#error=access_denied", NOW), { error: "access_denied" });
  assert.deepEqual(parseAuthFragment("#access_token=<script>", NOW), { error: "invalid_token" });
  const stale = jwt({ exp: NOW / 1_000 - 1 });
  assert.deepEqual(parseAuthFragment(`#access_token=${stale}`, NOW), { error: "expired" });
});

test("the authorize URL asks for an implicit-grant token", () => {
  const url = new URL(authorizeUrl("12345"));
  assert.equal(url.origin + url.pathname, "https://anilist.co/api/v2/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "12345");
  assert.equal(url.searchParams.get("response_type"), "token");
});
