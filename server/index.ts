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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  app.use(express.static(distPath));
  
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, "index.html"));
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
