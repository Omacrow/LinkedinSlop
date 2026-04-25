import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Load .env into process.env
try {
  const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".json": "application/json",
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // — API routes —
  if (pathname.startsWith("/api/")) {
    const body = await readBody(req);

    const mockReq = {
      method: req.method,
      query: Object.fromEntries(url.searchParams),
      body,
      headers: req.headers,
    };

    const pending = { status: 200, headers: {} };
    const mockRes = {
      setHeader(k, v) { pending.headers[k] = v; },
      status(code) { pending.status = code; return mockRes; },
      json(data) {
        pending.headers["Content-Type"] = "application/json";
        res.writeHead(pending.status, pending.headers);
        res.end(JSON.stringify(data));
      },
      end() {
        res.writeHead(pending.status, pending.headers);
        res.end();
      },
    };

    const segment = pathname.replace(/^\/api\//, "").split("?")[0];
    const handlerPath = path.join(__dirname, "api", `${segment}.js`);

    try {
      const mod = await import(pathToFileURL(handlerPath).href);
      await mod.default(mockReq, mockRes);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // — Static files from /public —
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = path.join(__dirname, "public", rel);

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`\n  Dev Carousel Generator`);
  console.log(`  http://localhost:${PORT}\n`);
});
