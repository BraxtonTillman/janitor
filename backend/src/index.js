import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import scoreRouter from "./routes/score.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CSP only on the HTML landing page (not on JSON APIs). default-src 'self'
// allows same-origin fetches (e.g. DevTools .well-known probe) without 'unsafe-inline'.
const LANDING_CSP = [
  "default-src 'self'",
  "script-src 'none'",
  "object-src 'none'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

app.use(cors({ origin: "*" })); // tighten this in production
app.use(express.json());

app.use("/api/score", scoreRouter);

// Quiet Chrome DevTools probing (otherwise 404 in Network tab).
app.get(
  "/.well-known/appspecific/com.chrome.devtools.json",
  (_, res) => res.type("json").send("{}")
);

app.get("/favicon.ico", (_, res) => res.status(204).end());

const LANDING_CSS = `body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem;line-height:1.5}`;

app.get("/landing.css", (_, res) => {
  res.type("css").set("Cache-Control", "public, max-age=3600").send(LANDING_CSS);
});

app.get("/", (_, res) => {
  res.set({
    "Content-Security-Policy": LANDING_CSP,
    "Cache-Control": "no-store",
  });
  res.type("html").send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Janitor API</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/landing.css"></head>
<body>
  <h1>Janitor backend</h1>
  <p>This server has no web UI. Use the Chrome extension or call the API directly.</p>
  <ul>
    <li><a href="/health"><code>GET /health</code></a> — liveness check</li>
    <li><code>GET /api/score?owner=&amp;repo=&amp;pr=</code> — PR score (optional header <code>x-github-token</code>)</li>
  </ul>
</body></html>`);
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Janitor backend running on http://localhost:${PORT}`);
});
