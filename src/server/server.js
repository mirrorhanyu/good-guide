import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import open from "open";
import { WebSocketServer } from "ws";
import { loadOrInitProject, saveProject } from "./project.js";
import { exportAll } from "./exporter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", ".."); // project root

export function startServer({ inputDir, outputDir, port = 4321 }) {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  // Static editor assets + shared ES modules (reused for in-browser rendering).
  app.use(express.static(path.join(ROOT, "public")));
  app.use("/shared", express.static(path.join(ROOT, "src", "shared")));

  // Current scene (reconciled with files on disk).
  app.get("/api/project", (req, res) => {
    try {
      res.json(loadOrInitProject(inputDir, outputDir));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Persist scene (autosave from the editor).
  app.put("/api/project", (req, res) => {
    try {
      const scene = req.body;
      scene.inputDir = inputDir;
      scene.outputDir = outputDir;
      const p = saveProject(scene);
      res.json({ ok: true, path: p });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Serve a source image by basename.
  app.get("/api/image", (req, res) => {
    const name = path.basename(String(req.query.file || ""));
    const full = path.join(inputDir, name);
    if (!fs.existsSync(full)) return res.status(404).end();
    res.sendFile(full);
  });

  // Run the batch export, streaming progress over SSE.
  app.get("/api/export", async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event, data) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const scene = loadOrInitProject(inputDir, outputDir);
      const results = await exportAll(scene, { onProgress: (p) => send("progress", p) });
      send("done", { results, outputDir });

      // Automatically open output directory and shut down the server process
      open(outputDir).catch(() => {});
      setTimeout(() => {
        console.log("[server] Export complete. Automatically shutting down server...");
        process.exit(0);
      }, 1500);
    } catch (e) {
      send("error", { message: e.message });
    } finally {
      res.end();
    }
  });

  const server = http.createServer(app);

  // Set up WebSocket server for auto-shutdown when no browser clients are connected
  const wss = new WebSocketServer({ server });
  let activeConnections = 0;
  let shutdownTimeout = null;

  wss.on("connection", (ws) => {
    activeConnections++;
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      shutdownTimeout = null;
      console.log("[server] Browser client connected. Cancelled auto-shutdown.");
    }

    ws.on("close", () => {
      activeConnections--;
      if (activeConnections <= 0) {
        console.log("[server] No active clients connected. Scheduling auto-shutdown in 5s...");
        shutdownTimeout = setTimeout(() => {
          console.log("[server] Auto-shutdown triggered (no clients connected). Exiting...");
          process.exit(0);
        }, 5000);
      }
    });

    ws.on("error", () => {
      // Quietly handle connection errors
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => resolve({ server, port, url: `http://localhost:${port}` }));
  });
}
