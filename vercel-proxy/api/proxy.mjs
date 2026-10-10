import {hasPaidTools,PREMIUM_MESSAGE} from '../premium-policy.mjs';
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
  const assets = [
    '<meta name="theme-color" content="#0b5267">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="星旅营地">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="stylesheet" href="/energy-ui.css?v=2">',
    '<link rel="stylesheet" href="/medal-ui.css?v=1">',
    '<link rel="stylesheet" href="/responsive-ui.css?v=1">',
    '<link rel="stylesheet" href="/monthly-ui.css?v=1">',
    '<link rel="stylesheet" href="/weekly-summary-ui.css?v=1">',
    '<link rel="stylesheet" href="/mobile-reminder-ui.css?v=1">',
    '<link rel="stylesheet" href="/starlane-ui.css?v=2">',
    '<link rel="stylesheet" href="/starlane-addons.css?v=5">',
    '<link rel="stylesheet" href="/starlane-full-timeline.css?v=8">',
    '<link rel="stylesheet" href="/traveler-guide.css?v=8">',
    '<script defer src="/energy-ui.js?v=2"></script>',
    '<script defer src="/medal-ui.js?v=1"></script>',
    '<script defer src="/monthly-ui.js?v=1"></script>',
    '<script defer src="/weekly-summary-ui.js?v=1"></script>',
    '<script defer src="/mobile-reminder-ui.js?v=1"></script>',
    '<script type="module" src="/starlane-ui.js?v=8"></script>',
    '<script type="module" src="/guide-entry.js?v=8"></script>',
    '<script defer src="/premium-ui.js?v=4"></script>',
    '<script defer src="/pwa-register.js?v=1"></script>'
  ].join("");
  return html.includes("</head>") ? html.replace("</head>", `${assets}</head>`) : `${assets}${html}`;
}

export default async function handler(req, res) {
  const target = upstreamUrl(req);
  let routePath;
  try{routePath=decodeURIComponent(target.pathname).replace(/\/{2,}/g,'/').replace(/\/$/,'');}catch{res.statusCode=400;return res.json({error:'无效路径'});}
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (skippedRequestHeaders.has(key.toLowerCase()) || value == null) return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  });
  headers.set("x-forwarded-host", new URL(PUBLIC_ORIGIN).host);

  let action='';
  if(req.method==='POST'&&routePath==='/api/game'){
    try{action=(typeof req.body==='string'||Buffer.isBuffer(req.body)?JSON.parse(String(req.body)):req.body)?.action||'';}catch{}
  }
  if(['importCalendar','syncGoogleCalendar'].includes(action)||['/api/google-calendar/connect','/api/google-calendar/callback'].includes(routePath)){
    res.setHeader('Cache-Control','private, no-store');
    try{
      const check=await fetch(`${UPSTREAM_ORIGIN}/api/game`,{headers:{cookie:req.headers.cookie||'','x-forwarded-host':new URL(PUBLIC_ORIGIN).host},redirect:'manual',signal:AbortSignal.timeout(15000)});
      if(check.status===401){res.statusCode=401;return res.json({error:'请先登录'});}
      if(!check.ok)throw new Error('membership unavailable');
      if(!hasPaidTools(await check.json())){res.statusCode=403;return res.json({error:PREMIUM_MESSAGE,code:'premium_required'});}
    }catch{res.statusCode=503;return res.json({error:'暂时无法核实会员权限，请稍后重试'});}
  }

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
