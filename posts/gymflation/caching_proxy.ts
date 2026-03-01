#!/usr/bin/env deno 

// deno --allow-env=UPSTREAM,LISTEN,CACHE_TTL_SECONDS,DEBUG --allow-read=.cache/proxy --allow-write=.cache/proxy --allow-net caching_proxy.ts
// lm_cache_proxy.ts
// Reverse proxy for LM Studio with simple disk cache keyed by request body hash.
// - Caches only non-streaming JSON POSTs (e.g., /v1/chat/completions).
// - Cache key = method + path + sha256(body).
// - Default TTL = 1 hour (override via env CACHE_TTL_SECONDS).

const UPSTREAM = Deno.env.get("UPSTREAM") ?? "http://127.0.0.1:1234";
const LISTEN = Deno.env.get("LISTEN") ?? "127.0.0.1:8080";
const CACHE_DIR = ".cache/proxy";
const TTL_SECONDS = Number(Deno.env.get("CACHE_TTL_SECONDS") ?? "3600");

await Deno.mkdir(CACHE_DIR, { recursive: true });

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(data: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(digest);
}

type CacheEntry = {
  expiresAt: number;
  status: number;
  headers: Record<string, string>;
  bodyBase64: string;
};

function nowMs() {
  return Date.now();
}

function shouldCache(req: Request, bodyBytes: Uint8Array): boolean {
  if (req.method !== "POST") return false;
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return false;

  // Don't cache streaming requests
  try {
    const txt = new TextDecoder().decode(bodyBytes);
    const j = JSON.parse(txt);
    if (j?.stream === true) return false;
  } catch {
    return false;
  }
  return true;
}

function cachePath(key: string) {
  return `${CACHE_DIR}/${key}.json`;
}

async function readCache(key: string): Promise<Response | null> {
  const path = cachePath(key);
  try {
    const txt = await Deno.readTextFile(path);
    const entry = JSON.parse(txt) as CacheEntry;
    if (entry.expiresAt <= nowMs()) return null;

    const body = Uint8Array.from(atob(entry.bodyBase64), (c) => c.charCodeAt(0));
    const headers = new Headers(entry.headers);
    headers.set("x-cache", "HIT");
    return new Response(body, { status: entry.status, headers });
  } catch {
    return null;
  }
}

async function writeCache(key: string, upstreamResp: Response, bodyBytes: Uint8Array) {
  const headersObj: Record<string, string> = {};
  upstreamResp.headers.forEach((v, k) => {
    // avoid hop-by-hop headers
    if (k.toLowerCase() === "transfer-encoding") return;
    headersObj[k] = v;
  });

  const entry: CacheEntry = {
    expiresAt: nowMs() + TTL_SECONDS * 1000,
    status: upstreamResp.status,
    headers: headersObj,
    bodyBase64: btoa(String.fromCharCode(...bodyBytes)),
  };

  await Deno.writeTextFile(cachePath(key), JSON.stringify(entry));
}

Deno.serve({ hostname: LISTEN.split(":")[0], port: Number(LISTEN.split(":")[1] ?? "8080") }, async (req) => {
  const url = new URL(req.url);
  const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM);
  const requestLine = `${req.method} ${upstreamUrl.pathname}${upstreamUrl.search}`;

  // Read body (we need it both for hashing and forwarding)
  const bodyBytes = new Uint8Array(await req.arrayBuffer());

  if (bodyBytes.length && Deno.env.get("DEBUG")) {
    try {
      console.log("body", JSON.parse(new TextDecoder().decode(bodyBytes)));
    } catch {
      console.log("body", null);
    }
  } else if (Deno.env.get("DEBUG")) {
    console.log("body", null);
  }

  // Build cache key (include path/query + body hash)
  const bodyHash = await sha256(bodyBytes);
  const key = await sha256(new TextEncoder().encode(`${req.method} ${upstreamUrl.pathname}${upstreamUrl.search} ${bodyHash}`));

  const cacheable = shouldCache(req, bodyBytes);
  if (cacheable) {
    const hit = await readCache(key);
    if (hit) {
      console.log(`${requestLine} cache=HIT`);
      return hit;
    }
  }

  // Forward request
  const fwdHeaders = new Headers(req.headers);
  // Ensure host reflects upstream
  fwdHeaders.delete("host");

  const upstreamResp = await fetch(upstreamUrl, {
    method: req.method,
    headers: fwdHeaders,
    body: bodyBytes.length ? bodyBytes : undefined,
  });

  // Read upstream body so we can cache & return it
  const respBytes = new Uint8Array(await upstreamResp.arrayBuffer());
  const respHeaders = new Headers(upstreamResp.headers);
  respHeaders.set("x-cache", "MISS");

  // Cache only successful JSON responses
  if (cacheable && upstreamResp.ok) {
    const ct = upstreamResp.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        await writeCache(key, upstreamResp, respBytes);
      } catch {
        // ignore cache write errors
      }
    }
  }

  console.log(`${requestLine} cache=MISS`);

  return new Response(respBytes, { status: upstreamResp.status, headers: respHeaders });
});
