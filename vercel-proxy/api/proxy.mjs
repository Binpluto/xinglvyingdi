const UPSTREAM_ORIGIN = "https://starcamp-life-adventure.tianyuanzhaodg.chatgpt.site";
const PUBLIC_ORIGIN = "https://starcamp-life-adventure.vercel.app";

const skippedRequestHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
  "accept-encoding",
]);

const skippedResponseHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

function upstreamUrl(req) {
  const incoming = new URL(req.url || "/", "https://vercel-proxy.local");
  const rawPath = Array.isArray(req.query?.path) ? req.query.path.join("/") : (req.query?.path || "");
  const target = new URL(`/${String(rawPath).replace(/^\/+/, "")}`, UPSTREAM_ORIGIN);
  incoming.searchParams.forEach((value, key) => {
    if (key !== "path") target.searchParams.append(key, value);
  });
  return target;
}

function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (req.body == null) return undefined;
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return req.body;
  return JSON.stringify(req.body);
}

function injectVercelEnhancements(html) {
  const assets = '<link rel="stylesheet" href="/energy-ui.css?v=2"><script defer src="/energy-ui.js?v=2"></script>';
  return html.includes("</head>") ? html.replace("</head>", `${assets}</head>`) : `${assets}${html}`;
}

export default async function handler(req, res) {
  const target = upstreamUrl(req);
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (skippedRequestHeaders.has(key.toLowerCase()) || value == null) return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  });
  headers.set("x-forwarded-host", new URL(PUBLIC_ORIGIN).host);

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: requestBody(req),
    redirect: "manual",
  });

  upstream.headers.forEach((value, key) => {
    if (skippedResponseHeaders.has(key.toLowerCase()) || key.toLowerCase() === "set-cookie") return;
    if (key.toLowerCase() === "location") {
      res.setHeader(key, value.replace(UPSTREAM_ORIGIN, PUBLIC_ORIGIN));
      return;
    }
    res.setHeader(key, value);
  });
  const cookies = upstream.headers.getSetCookie?.() || [];
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.statusCode = upstream.status;

  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    res.send(injectVercelEnhancements(await upstream.text()));
    return;
  }
  res.send(Buffer.from(await upstream.arrayBuffer()));
}
