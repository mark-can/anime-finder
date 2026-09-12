import {
  ANILIST_ENDPOINT,
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  INITIAL_REQUEST_GAP_MS,
  MAX_PAGES_PER_PASS,
  REQUEST_TIMEOUT_MS,
} from "./config.js";

function buildMediaQuery(variables, serverSort) {
  const declarations = ["$page:Int"];
  const argumentsList = ["type:ANIME", "isAdult:false", `sort:${serverSort}`];
  if (variables.genre) {
    declarations.push("$genre:String");
    argumentsList.push("genre:$genre");
  }
  if (variables.startLt) {
    declarations.push("$startLt:FuzzyDateInt");
    argumentsList.push("startDate_lesser:$startLt");
  }
  if (variables.endGt) {
    declarations.push("$endGt:FuzzyDateInt");
    argumentsList.push("endDate_greater:$endGt");
  }
  if (variables.popularityGt) {
    declarations.push("$popularityGt:Int");
    argumentsList.push("popularity_greater:$popularityGt");
  }
  if (variables.statusIn) {
    declarations.push("$statusIn:[MediaStatus]");
    argumentsList.push("status_in:$statusIn");
  }
  if (variables.formatIn?.length) {
    declarations.push("$formatIn:[MediaFormat]");
    argumentsList.push("format_in:$formatIn");
  }

  return `query (${declarations.join(",")}){
    Page(page:$page, perPage:50){
      pageInfo{ hasNextPage }
      media(${argumentsList.join(", ")}){
        id idMal siteUrl format episodes status averageScore popularity
        title{ romaji english }
        startDate{ year month day }
        endDate{ year month day }
        genres
        coverImage{ medium }
        stats{ scoreDistribution{ amount } }
      }
    }
  }`;
}

export class ApiError extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfter = options.retryAfter ?? null;
    this.details = options.details ?? null;
  }
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}

function wait(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(done, milliseconds);
    signal?.addEventListener("abort", cancelled, { once: true });

    function done() {
      signal?.removeEventListener("abort", cancelled);
      resolve();
    }

    function cancelled() {
      window.clearTimeout(timeout);
      reject(abortError());
    }
  });
}

class RequestGate {
  nextRequestAt = 0;
  gap = INITIAL_REQUEST_GAP_MS;

  async beforeRequest(signal) {
    const delay = this.nextRequestAt - Date.now();
    if (delay > 0) await wait(delay, signal);
    this.nextRequestAt = Date.now() + this.gap;
  }

  updateFromHeaders(headers) {
    const limit = Number(headers.get("x-ratelimit-limit"));
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    const resetAt = Number(headers.get("x-ratelimit-reset"));

    if (Number.isFinite(limit) && limit > 0) {
      this.gap = Math.max(INITIAL_REQUEST_GAP_MS, Math.ceil(60_000 / limit) + 100);
    }

    if (remaining <= 1 && Number.isFinite(resetAt) && resetAt > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, resetAt * 1_000 + 250);
    }
  }

  postpone(milliseconds) {
    this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + milliseconds);
  }
}

const requestGate = new RequestGate();
const responseCache = new Map();

function getCached(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}

function setCached(key, value) {
  responseCache.set(key, { savedAt: Date.now(), value });
  while (responseCache.size > CACHE_MAX_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value);
  }
}

function timeoutSignal(parentSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener("abort", forwardAbort, { once: true });

  return {
    signal: controller.signal,
    wasTimeout: () => timedOut,
    dispose() {
      window.clearTimeout(timeout);
      parentSignal.removeEventListener("abort", forwardAbort);
    },
  };
}

async function requestPage(variables, { signal, onWait }) {
  const { serverSort = "SCORE_DESC", ...graphqlVariables } = variables;
  const cleanVariables = Object.fromEntries(Object.entries(graphqlVariables).filter(([, value]) => value != null));
  const query = buildMediaQuery(cleanVariables, serverSort);
  const key = JSON.stringify({ query, variables: cleanVariables });
  const cached = getCached(key);
  if (cached) return cached;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await requestGate.beforeRequest(signal);
    const timed = timeoutSignal(signal);

    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: cleanVariables }),
        signal: timed.signal,
      });
      requestGate.updateFromHeaders(response.headers);

      if (response.status === 429) {
        const retryAfter = Math.max(1, Number(response.headers.get("retry-after")) || 30);
        if (attempt === 0) {
          requestGate.postpone(retryAfter * 1_000);
          onWait?.(retryAfter);
          await wait(retryAfter * 1_000, signal);
          continue;
        }
        throw new ApiError("rateLimit", { status: 429, retryAfter });
      }

      if (response.status === 403) throw new ApiError("unavailable", { status: 403 });
      if (!response.ok) {
        const details = (await response.text()).slice(0, 500);
        throw new ApiError("http", { status: response.status, details });
      }

      const payload = await response.json();
      if (payload.errors?.length) {
        const status = payload.errors[0]?.status ?? 400;
        throw new ApiError(status === 429 ? "rateLimit" : "http", {
          status,
          details: payload.errors.map((error) => error.message).filter(Boolean).join("; "),
        });
      }
      if (!payload.data?.Page) throw new ApiError("invalidResponse");

      setCached(key, payload.data.Page);
      return payload.data.Page;
    } catch (error) {
      if (error.name === "AbortError") {
        if (signal.aborted) throw abortError();
        if (timed.wasTimeout()) throw new ApiError("timeout");
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError("network");
    } finally {
      timed.dispose();
    }
  }

  throw new ApiError("rateLimit", { retryAfter: 30 });
}

function queryPasses(filters) {
  const startLt = filters.year * 10_000 + 1231;
  const endGt = filters.year * 10_000 + 101;

  if (filters.status === "finished") {
    return [{ startLt, endGt, statusIn: ["FINISHED"] }];
  }
  if (filters.status === "ongoing") {
    return [{ startLt, endGt: null, statusIn: ["RELEASING", "HIATUS"] }];
  }
  return [
    { startLt, endGt, statusIn: null },
    { startLt, endGt: null, statusIn: ["RELEASING", "HIATUS"] },
  ];
}

// A title can only be rated by users who have it on their list, so its rating
// count never exceeds its popularity. Asking AniList to skip anything well below
// the ratings threshold prunes most pages without dropping a single match.
function popularityFloor(minRatings) {
  return minRatings > 0 ? Math.floor(minRatings * 0.9) : null;
}

export async function collectMedia(filters, { signal, onProgress, onWait } = {}) {
  const passes = queryPasses(filters);
  const collected = new Map();
  let truncated = false;

  for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
    const pass = passes[passIndex];

    for (let page = 1; page <= MAX_PAGES_PER_PASS; page += 1) {
      if (signal.aborted) throw abortError();
      onProgress?.({
        found: collected.size,
        page,
        pass: passIndex + 1,
        totalPasses: passes.length,
      });

      const data = await requestPage(
        {
          page,
          genre: filters.genre || null,
          formatIn: filters.formats,
          popularityGt: popularityFloor(filters.minRatings),
          serverSort: filters.sort === "votes" ? "POPULARITY_DESC" : "SCORE_DESC",
          ...pass,
        },
        { signal, onWait },
      );

      for (const media of data.media) {
        if (!collected.has(media.id)) collected.set(media.id, media);
      }

      if (!data.pageInfo.hasNextPage) break;
      if (page === MAX_PAGES_PER_PASS) truncated = true;
    }
  }

  return { media: [...collected.values()], truncated };
}
