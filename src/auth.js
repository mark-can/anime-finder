import { ANILIST_AUTHORIZE_URL, AUTH_CLIENTS, AUTH_RETURN_KEY, AUTH_STORAGE_KEY } from "./config.js";

// AniList access tokens are JWTs; their `exp` claim says when they stop
// working. AniList also sends `expires_in` (seconds) next to the token.
export function tokenExpiry(token, expiresIn = null, now = Date.now()) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const exp = JSON.parse(atob(base64)).exp;
    if (Number.isFinite(exp) && exp > 0) return exp * 1_000;
  } catch {
    // Not a readable JWT: fall back to expires_in.
  }
  const seconds = Number(expiresIn);
  return Number.isFinite(seconds) && seconds > 0 ? now + seconds * 1_000 : null;
}

// Reads what AniList put in the URL fragment after the sign-in page:
// `#access_token=…&token_type=Bearer&expires_in=…`, or an error.
export function parseAuthFragment(hash, now = Date.now()) {
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (params.has("error")) return { error: params.get("error") || "unknown" };
  const token = params.get("access_token");
  if (!token) return null;
  if (!/^[\w.-]+$/.test(token)) return { error: "invalid_token" };
  const expiresAt = tokenExpiry(token, params.get("expires_in"), now);
  if (expiresAt !== null && expiresAt <= now) return { error: "expired" };
  return { token, expiresAt };
}

export function clientIdFor(location = globalThis.location) {
  if (!location) return "";
  return AUTH_CLIENTS[`${location.origin}${location.pathname}`] ?? "";
}

export function authorizeUrl(clientId) {
  const url = new URL(ANILIST_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "token");
  return url.toString();
}

function storage(kind) {
  try {
    return globalThis[kind] ?? null;
  } catch {
    return null;
  }
}

export function loadSession(now = Date.now()) {
  try {
    const saved = JSON.parse(storage("localStorage")?.getItem(AUTH_STORAGE_KEY) ?? "null");
    if (typeof saved?.token !== "string" || !saved.token) return null;
    if (saved.expiresAt && saved.expiresAt <= now) {
      clearSession();
      return null;
    }
    return { token: saved.token, expiresAt: saved.expiresAt ?? null };
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    storage("localStorage")?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Without storage the sign-in lasts until the page is closed.
  }
}

export function clearSession() {
  try {
    storage("localStorage")?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

// AniList returns to the registered page address, which drops the filters in
// the query string; they wait in sessionStorage until the browser is back.
export function beginSignIn(clientId, location = globalThis.location) {
  try {
    storage("sessionStorage")?.setItem(AUTH_RETURN_KEY, location.search);
  } catch {
    // The defaults load instead of the old filters.
  }
  location.assign(authorizeUrl(clientId));
}

// Run before the URL is parsed for filters. Takes the token out of the address
// bar and puts the saved filters back. Returns null when this page load is not
// a return from AniList.
export function consumeRedirect(location = globalThis.location, history = globalThis.history) {
  const result = parseAuthFragment(location.hash);
  if (!result) return null;

  let search = location.search;
  try {
    const saved = storage("sessionStorage")?.getItem(AUTH_RETURN_KEY);
    storage("sessionStorage")?.removeItem(AUTH_RETURN_KEY);
    if (typeof saved === "string" && (saved === "" || saved.startsWith("?"))) search = saved;
  } catch {
    // Keep whatever the address already had.
  }
  history.replaceState(null, "", `${location.pathname}${search}`);

  if (result.token) saveSession({ token: result.token, expiresAt: result.expiresAt });
  return result;
}
