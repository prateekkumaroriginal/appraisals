import { Readable } from "node:stream";

const LOCOMO_BASE_URL = "https://apiv6.locomo.io";

const hopByHopHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    setCorsHeaders(res);
    res.status(405).json({ message: "Only GET requests are supported." });
    return;
  }

  const requestUrl = new URL(req.url || "", `https://${req.headers.host || "localhost"}`);
  const path = getLocomoPath(req, requestUrl);
  if (!path) {
    setCorsHeaders(res);
    res.status(400).json({ message: "Missing Locomo API path." });
    return;
  }

  const upstreamUrl = `${LOCOMO_BASE_URL}/${path}${requestUrl.search}`;
  const upstream = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Accept: req.headers.accept || "application/json, text/plain, */*",
      Authorization: req.headers.authorization || "",
      "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Origin: "https://v2.locomo.io",
      Pragma: "no-cache",
      Referer: "https://v2.locomo.io/hrm/appraisal/performancemanagement/",
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
    },
    redirect: "follow",
  });

  setCorsHeaders(res);
  res.status(upstream.status);

  upstream.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  res.setHeader("Cache-Control", "no-store");

  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body).pipe(res);
}

function getLocomoPath(req, requestUrl) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath) && queryPath.length) return queryPath.join("/");
  if (typeof queryPath === "string" && queryPath) return queryPath;

  return requestUrl.pathname
    .replace(/^\/api\/locomo\/?/, "")
    .replace(/^\/+/, "");
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Accept, Cache-Control, Pragma, Content-Type");
}
