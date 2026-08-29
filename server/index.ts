import "dotenv/config"; // load environment variables from .env for local development
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
// Scanned photos arrive as base64 JSON. express.json()'s default limit is 100KB, so a
// real phone photo (500KB-3MB encoded) was rejected with 413 before it ever reached the
// vision model. The client downscales before uploading; this is the backstop.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Simple request logger to help debug incoming API calls from the dev client
app.use((req, res, next) => {
  try {
    console.log(`[server] ${req.method} ${req.path}`);
  } catch (e) {
    // ignore logging errors
  }
  next();
});

(async () => {
  const server = await registerRoutes(app);

  const distPath = path.join(__dirname, "..", "dist");

  // Asset filenames are content-hashed, so they're safe to cache hard. index.html is
  // not — it's what points at the current bundle, so a cached copy keeps serving the
  // previous deploy's JS and users see stale code until they hard-refresh.
  const noCacheHtml = { etag: false, lastModified: false, cacheControl: false, headers: { "Cache-Control": "no-cache" } };

  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
    },
  }));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, "index.html"), noCacheHtml);
    } else {
      next();
    }
  });

  // Hosts like Render assign the port at runtime; 5000 is only the local default.
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
})();
